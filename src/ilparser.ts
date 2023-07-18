import { Uri } from "vscode"
import * as vscode from 'vscode'
import * as fs from 'fs';

type Position = { line: number, charactar: number }
type Range = { begin: Position, end: Position }
export type Expr = Local | Operand
export type Local = { name: string, define: string, children: Operand[], range: Range }
export type Operand = { name: string, pos: Position }

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
        return this.matchInfo.get(line)!
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

export function parseFromUri(uri: Uri): Local[] {
    var content = fs.readFileSync(uri.fsPath).toString()
    return parseSrc(content)
}

export function parseSrc(content: string): Local[] {
    var lines = content.split("\n")
    var n = lines.length
    let ctx = new ParseCtxt(lines)
    if(lines[0].includes("->")) {
        var fn = parseFunBody(lines, 0, n,  ctx, true)
        var body = parseFunBody(lines, 0 + 2, n - 2, ctx, false)
        return fn.concat(body)
    } else {
        return parseFunBody(lines, 0, n, ctx, false)
    }
}

// todo: 没有处理{ 和 }
function parseFunBody(lines: string[], i: number, end: number, ctx: ParseCtxt, once: boolean): Local[] {
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
        if(once) {
            return data
        }
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
function parseFunction(lines: string[], i: number, ctxt: ParseCtxt): [Local, number] {
    let line = lines[i]
    let data = line.split("=")
    let name = data[0].trim()
    let decl = data[1]
    let vars = findMatches(decl)
    let close = ctxt.getMatchPair(i + 1)
    let define = lines.slice(i, close).join("\n")
    let f: Local = {
        name: name,
        define: define,
        children: [],
        range: defualtRange()
    }
    return [f, close + 1]
}

