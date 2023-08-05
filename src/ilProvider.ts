import { DocumentSymbolProvider, TextDocument, CancellationToken, ProviderResult, SymbolInformation, DocumentSymbol, DefinitionProvider, Position, Definition, LocationLink, ReferenceProvider, ReferenceContext, Location, HoverProvider, Hover, ExtensionContext, languages, Diagnostic, workspace, Uri } from "vscode"
import { Expr, Local, Operand, Var, parseFromUri, parseSrc, toVSRange, defaultFunction, getType } from "./ilparser"
import { MarkedString, SymbolKind } from "vscode-languageclient"
import exp = require("constants")

class NBoxContext {
    fun = defaultFunction()
    data: Local[] = []
    diagnosticCollection = languages.createDiagnosticCollection('il')
    map: Map<string, Local> = new Map()
    varMap: Map<string, Var> = new Map()
    findLocal(line: number): Local | undefined {
        return ctx.data.find(expr => expr.range.begin.line == line)
    }

    findExprByPos(position: Position): Expr | undefined {
        let local = this.findLocal(position.line)
        if(local == undefined)
        {
            return undefined
        }
        let posC = position.character
        let localC = local.range.begin.charactar
        if(inSpan(localC, posC, localC + local.name.length)) {
            return local
        }
        return local.children.find(operand => {
            let c = operand.pos.charactar
            return inSpan(c, posC, c + operand.name.length)
        })!
    }
    
    findLocalById(id: string): Local | undefined {
        // return ctx.data.find(d => d.name == id)
        return ctx.map.get(id)
    }
    
    findUsers(expr: Expr): Local[] {
        return ctx.data.filter(e => {
            if(e.children == undefined) {
                return false
            }
            var a = e.children.length != 0 
            var b = e.children.find(operand => {
                return operand.name == expr.name
            })
            return a && (b != undefined)
        })
    }

    findParam(id: string): Var | undefined {
        return this.varMap.get(id)
    }

    findParamByCharacter(c: number): Var | undefined {
        let result = this.fun.vars.filter(v => inSpan(v.range.begin.charactar, c, v.range.end.charactar))
        if(result.length == 0) {
            return undefined
        } else {
            return result[0]
        } 
    }
}

let ctx = new NBoxContext()

class ILDocumentSymbolProvider implements DocumentSymbolProvider {
    provideDocumentSymbols(document: TextDocument, token: CancellationToken): ProviderResult<SymbolInformation[] | DocumentSymbol[]> {
        let uri = document.uri
        initDocumentInfo(uri)
        let diagnostics = ctx.data.filter(line => line.define.split("\n").length <= 1 && line.define.includes("invalid")).map(local =>  {
            let s = "invalid:"
            let i = local.define.indexOf(s)
            let msg = local.define.slice(i + s.length)
            return new Diagnostic(toVSRange(local.range), msg)
        })
        ctx.diagnosticCollection.set(uri, diagnostics)
        return ctx.data.filter(line => line.define.split("\n").length > 1).map(f => {
            return new SymbolInformation(f.name, SymbolKind.Function, "", new Location(uri, new Position(f.range.begin.line, f.range.begin.charactar)))
        })
    }
}

function inSpan(start: number, pos: number, end: number) {
    return (start <= pos) && (pos <= end)
}

class ILDefinitionProvider implements DefinitionProvider {
    provideDefinition(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Definition | LocationLink[]> {
        let uri = document.uri
        let expr = ctx.findExprByPos(position)
        if(expr == undefined) {
            return null
        }
        let exprId = expr.name
        let parent = ctx.findLocalById(exprId)
        if(parent == undefined) {
            let param = ctx.findParam(exprId)
            if(param != undefined) {
                return new Location(uri, toVSRange(param.range))
            } else {
                return null
            }
        } else {
            return new Location(uri, toVSRange(parent.range))
        }
    }
}

class ILReferenceProvider implements ReferenceProvider {
    provideReferences(document: TextDocument, position: Position, context: ReferenceContext, token: CancellationToken): ProviderResult<Location[]> {
        let uri = document.uri
        let expr: Expr | undefined = ctx.findLocal(position.line)
        // console.log(expr)
        if(expr == undefined) {
            if(position.line == ctx.fun.range.begin.line) {
                // find param
                let v = ctx.findParamByCharacter(position.character)
                if(v == undefined) {
                    return null
                } else {
                    expr = v
                }
            } else {
                return null
            }
        }
        let users = ctx.findUsers(expr)
        return users.map(expr => new Location(uri, toVSRange(expr.range)))
    }
}

class ILHoverProvier implements HoverProvider {
    provideHover(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Hover> {
        let expr = ctx.findExprByPos(position)
        if(expr == undefined)
        {
            return null
        }
        let users = ctx.findUsers(expr)
        var typeinfo = "" 
        // local
        if('define' in expr)
        {
            typeinfo = getType(expr)
        }
        // operand
        else
        {
            let operand = ctx.findLocalById(expr.name)
            if(operand != undefined) {
                typeinfo = getType(operand)
            }
        }
        let str = `${expr.name} ${typeinfo} users: ${users.length} ${users.map(user => user.name).join(" ")}`
        return new Hover(MarkedString.fromPlainText(str))
    }
}

function initDocumentInfo(uri: Uri) {
    console.log("initDoc")
    ctx.fun = parseFromUri(uri)
    let data = ctx.fun.locals.filter((l): l is Local => {
        return true;
    })
    ctx.data = data
    ctx.map = new Map(data.map(item => [item.name, item]))
    ctx.varMap = new Map(ctx.fun.vars.map(v => [v.name, v]))
}

export function registProvider(extCtx: ExtensionContext) {
    let documentSelector = ['nil']
    extCtx.subscriptions.push(languages.registerDocumentSymbolProvider(documentSelector, new ILDocumentSymbolProvider()))
    extCtx.subscriptions.push(languages.registerDefinitionProvider(documentSelector, new ILDefinitionProvider()))
    extCtx.subscriptions.push(languages.registerReferenceProvider(documentSelector, new ILReferenceProvider()))
    extCtx.subscriptions.push(languages.registerHoverProvider(documentSelector, new ILHoverProvier()))
    extCtx.subscriptions.push(ctx.diagnosticCollection)
    // extCtx.subscriptions.push(workspace.onDidOpenTextDocument(initDocumentInfo))
}

