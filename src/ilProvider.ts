import { DocumentSymbolProvider, TextDocument, CancellationToken, ProviderResult, SymbolInformation, DocumentSymbol, DefinitionProvider, Position, Definition, LocationLink, ReferenceProvider, ReferenceContext, Location, HoverProvider, Hover, ExtensionContext, languages, Diagnostic, workspace, Uri } from "vscode"
import { Expr, Local, Operand, parseFromUri, parseSrc, toVSRange, defaultFunction, getType } from "./ilparser"
import { MarkedString, SymbolKind } from "vscode-languageclient"

class NBoxContext {
    fun = defaultFunction()
    data: Local[] = []
    diagnosticCollection = languages.createDiagnosticCollection('il')
    map: Map<string, Local> = new Map()
    findLocal(line: number): Local {
        return ctx.data.find(expr => expr.range.begin.line == line)!
    }

    findExprByPos(position: Position): Expr {
        let local = this.findLocal(position.line)
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
            var a = e.children.length != 0 
            var b = e.children.find(operand => {
                return operand.name == expr.name
            })
            return a && (b != undefined)
        })
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

function inSpan(a: number, x: number, b: number) {
    return (a <= x) && (x <= b)
}

class ILDefinitionProvider implements DefinitionProvider {
    provideDefinition(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Definition | LocationLink[]> {
        let uri = document.uri
        let expr = ctx.findExprByPos(position)
        let parent = ctx.findLocalById(expr.name)!
        return new Location(uri, toVSRange(parent.range))
    }
}

class ILReferenceProvider implements ReferenceProvider {
    provideReferences(document: TextDocument, position: Position, context: ReferenceContext, token: CancellationToken): ProviderResult<Location[]> {
        let uri = document.uri
        let expr = ctx.findLocal(position.line)
        // console.log(expr)
        let users = ctx.findUsers(expr)
        return users.map(expr => new Location(uri, toVSRange(expr.range)))
    }
}

class ILHoverProvier implements HoverProvider {
    provideHover(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Hover> {
        let expr = ctx.findExprByPos(position)
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

