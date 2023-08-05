import { Uri } from "vscode"
import * as vscode from 'vscode'
import * as fs from 'fs';
import exp = require("constants");

type Position = { line: number, charactar: number }
type Range = { begin: Position, end: Position }
export type Expr = Local | Operand | Var
export type Local = { name: string, define: string, children: Operand[], range: Range }
export type Function = { name: string, define: string, locals: (Local | Function)[], range: Range, vars: Var[]}
export type Var = { name: string, type: string, range: Range }
export type Operand = { name: string, pos: Position }

export function getType(local: Local) {
    let list = local.define.split("//")
    return list[list.length - 1].trim()
}

export function toVSPosition(pos: Position) {
    return new vscode.Position(
        pos.line,
        pos.charactar,
    )
}

export function toVSRange(range: Range) {
    return new vscode.Range(
        toVSPosition(range.begin),
        toVSPosition(range.end),
    )
}

export function defaultFunction(): Function {
    return {
        name: "empty",
        define: "empty",
        locals: [],
        range: {
            begin: {
                line: 0,
                charactar: 0
            },
            end: {
                line: 0,
                charactar: 0
            }
        },
        vars: []
    }
}

function defualtRange(): Range {
    return {
        begin: {
            line: 0,
            charactar: 0
        },
        end: {
            line: 0,
            charactar: 0
        },
    }
}

class ParseCtxt {
    private lines: string[]
    private matchInfo: Map<number, number>

    constructor(lines: string[]) {
        this.lines = lines
        this.matchInfo = new Map()
        // update match info
        this.findMatch(lines)
    }

    getMatchPair(line: number): number {
        var result = this.matchInfo.get(line)
        if(result == undefined) {
            return -1
        }
        return result
    }

    // get function info
    private findMatch(lines: string[]) {
        let stack = [];
        for (let i = 0; i < lines.length; i++) {
            if(lines[i].includes("{") && lines[i].includes("}")) {
                continue
            }
            if (lines[i].includes("{")) {
                stack.push(i);
            } else if (lines[i].includes("}")) {
                let left = stack.pop();
                if (left !== undefined) {
                    // new match
                    this.matchInfo.set(left, i)
                }
            }
        }
    }
}

export function parseFromUri(uri: Uri): Function {
    var content = fs.readFileSync(uri.fsPath).toString()
    return parseSrc(content)
}

export function parseSrc(content: string): Function {
    var lines = content.split("\n")
    var n = lines.length
    let ctx = new ParseCtxt(lines)
    let body = parseFunBody(lines, 0, n, ctx)
    let funs = body.filter((l): l is Function => {
        return true;
    })
    if(funs.length == 1) {
        return funs[0]
    }
    let f: Function = {
        name: "empty",
        define: content,
        locals: body,
        range: {
            begin: {
                line: 0,
                charactar: 0
            },
            end: {
                line: n,
                charactar: lines[lines.length - 1].length
            }
        },
        vars: []
    }
    return f
}

// todo: 没有处理{ 和 }
function parseFunBody(lines: string[], i: number, end: number, ctx: ParseCtxt): (Local | Function)[] {
    var data = []
    // 1. il is one method
    // 2. il is expr
    while (i < end) {
        var line = lines[i]
        if(line.trim() == "") {
            ++i
            continue
        }
        const oldI = i
        var [expr, newI] = line.includes("->") ? parseFunction(lines, i, ctx) : parseCall(lines, i, ctx)
        i = newI
        expr.range = {
            begin: {
                line: oldI,
                charactar: 0
            },
            end: {
                line: newI - 1,
                charactar: lines[newI - 1].length - 1
            },
        }
        data.push(expr)
    }
    return data
}

function findMatches(str: string) {
    const regex = /%[0-9a-zA-Z_]+/g;
    let match;
    const matches = []
    while((match = regex.exec(str)) != null) {
        matches?.push(match)
    }
    return matches;
}

function parseCall(lines: string[], i: number, ctxt: ParseCtxt): [Local, number] {
    let line = lines[i]
    let data = line.split("=")
    let name = data[0].trim()
    let define = data[1]
    let children: Operand[] = findMatches(line).slice(1).map(x => {
        let operand: Operand = {
            name: x[0],
            pos: {
                line: i,
                charactar: x.index
            }
        }
        return operand
    })
    let expr: Local = {
        name: name,
        define: define,
        children: children,
        range: defualtRange()
    }
    return [expr, i + 1]
}

// return new line and function
function parseFunction(lines: string[], i: number, ctxt: ParseCtxt): [Function, number] {
    let line = lines[i]
    let data = line.split("=")
    let name = data[0].trim()
    let decl = data[1]
    let vars = findMatches(decl).map(x => {
        let index: number = data[0].length + x.index
        let end = index + x[0].length
        var splitData = x.input.slice(end).split("],")
        if(splitData.length == 0) {
            splitData = x.input.slice(end).split(")")
        }
        let type = (splitData[0] + "]").trim()
        let v: Var = {
            name: x[0],
            type: type,
            range: {
                begin: {
                    line: i,
                    charactar: index
                },
                end: {
                    line: i,
                    charactar: end
                }
            }
        }
        return v
    })
    let close = ctxt.getMatchPair(i + 1)
    let define = lines.slice(i, close).join("\n")
    let locals = parseFunBody(lines, i + 2, close, ctxt)
    let f: Function = {
        name: name,
        define: define,
        locals: locals,
        range: defualtRange(),
        vars: vars
    }
    return [f, close + 1]
}

