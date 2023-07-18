import { DocumentSymbolProvider, TextDocument, CancellationToken, ProviderResult, SymbolInformation, DocumentSymbol, DefinitionProvider, Position, Definition, LocationLink, ReferenceProvider, ReferenceContext, Location, HoverProvider, Hover, ExtensionContext, languages, Diagnostic } from "vscode"
import { Expr, Local, Operand, parseFromUri, parseSrc, toVSRange } from "./ilparser"
import { MarkedString, SymbolKind } from "vscode-languageclient"

class NBoxContext {
    data: Local[] = []
    diagnosticCollection = languages.createDiagnosticCollection('il')
}

let ctx = new NBoxContext()

// todo: maybe error in windows
function nncaseRoot(path: string) {
    var list = path.split("/")
    var index = list.indexOf("tests_output")
    if(index == -1) {
        return null
    }
    return list.slice(0, index).join("/")
}

function gotoTest() {
    
}

class ILDocumentSymbolProvider implements DocumentSymbolProvider {
    provideDocumentSymbols(document: TextDocument, token: CancellationToken): ProviderResult<SymbolInformation[] | DocumentSymbol[]> {
        console.log("provideDocumentSymbols1")
        let uri = document.uri
        ctx.data = parseFromUri(uri)
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

function findLocal(line: number): Local {
    return ctx.data.find(expr => expr.range.begin.line == line)!
}
function findExprByPos(position: Position): Expr {
    let local = findLocal(position.line)
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

function findLocalById(id: string): Local {
    return ctx.data.find(d => d.name == id)!
}

function findUsers(expr: Expr): Local[] {
    return ctx.data.filter(e => {
        var a = e.children.length != 0 
        var b = e.children.find(operand => {
            return operand.name == expr.name
        })
        return a && (b != undefined)
    })
}

class ILDefinitionProvider implements DefinitionProvider {
    provideDefinition(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Definition | LocationLink[]> {
        console.log("def")
        let uri = document.uri
        let expr = findExprByPos(position)
        console.log(expr)
        let parent = findLocalById(expr.name)
        console.log(parent)
        return new Location(uri, toVSRange(parent.range))
    }
}

class ILReferenceProvider implements ReferenceProvider {
    provideReferences(document: TextDocument, position: Position, context: ReferenceContext, token: CancellationToken): ProviderResult<Location[]> {
        console.log("provideReferences")
        let uri = document.uri
        let expr = findLocal(position.line)
        console.log(expr)
        let users = findUsers(expr)
        return users.map(expr => new Location(uri, toVSRange(expr.range)))
    }
}

class ILHoverProvier implements HoverProvider {
    provideHover(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Hover> {
        console.log("provideHover")
        let expr = findExprByPos(position)
        let users = findUsers(expr)
        let str = `name:${expr.name} users: ${users.length} ${users.map(user => user.name).join(" ")}`
        console.log(expr)
        return new Hover(MarkedString.fromPlainText(str))
    }
}

export function registProvider(extCtx: ExtensionContext) {
    console.log("register")
    let documentSelector = [{ scheme: 'file', language: 'plaintext' }]
    extCtx.subscriptions.push(languages.registerDocumentSymbolProvider(documentSelector, new ILDocumentSymbolProvider()))
    extCtx.subscriptions.push(languages.registerDefinitionProvider(documentSelector, new ILDefinitionProvider()))
    extCtx.subscriptions.push(languages.registerReferenceProvider(documentSelector, new ILReferenceProvider()))
    extCtx.subscriptions.push(languages.registerHoverProvider(documentSelector, new ILHoverProvier()))
    extCtx.subscriptions.push(ctx.diagnosticCollection)
}

