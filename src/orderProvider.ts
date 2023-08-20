import { CancellationToken, Definition, DefinitionProvider, DocumentSymbol, DocumentSymbolProvider, ExtensionContext, Location, LocationLink, Position, ProviderResult, SymbolInformation, TextDocument, Uri, languages, window, workspace } from "vscode"
import * as fs from 'fs';
import * as path from 'path';
import { Order, parseOrder } from "./orderParser";

let order: Order[]

class OrderDefinitionProvider implements DefinitionProvider {
    provideDefinition(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Definition | LocationLink[]> {
        let uri = document.uri
        let line = position.line
        let dir = path.dirname(uri.path)
        let name = this.getOrderName(line)
        let targetPath = path.join(dir, name)
        workspace.openTextDocument(targetPath).then((textDocument) => {
            window.showTextDocument(textDocument)
        })
        return null
    }

    getOrderName(line: number) {
        return `${line+1}$${order[line].op}`
    }
}

function initOrder(uri: Uri) {
    let content = fs.readFileSync(uri.path).toString()
    order = parseOrder(content)
}
class OrderDocumentSymbolProvider implements DocumentSymbolProvider {
    provideDocumentSymbols(document: TextDocument, token: CancellationToken): ProviderResult<SymbolInformation[] | DocumentSymbol[]> {
        initOrder(document.uri)
        return null
    }
}

export function registOrderProvider(extCtx: ExtensionContext) {
    let documentSelector = { pattern: '**/!out_shape_list' }
    extCtx.subscriptions.push(languages.registerDefinitionProvider(documentSelector, new OrderDefinitionProvider()))
    extCtx.subscriptions.push(languages.registerDocumentSymbolProvider(documentSelector, new OrderDocumentSymbolProvider()))
    extCtx.subscriptions.push(workspace.onDidOpenTextDocument(doc => {
        initOrder(doc.uri)
    }))
    extCtx.subscriptions.push(workspace.onDidSaveTextDocument(doc => {
        initOrder(doc.uri)
    }))
}