import { CancellationToken, Definition, DefinitionProvider, DocumentSymbol, DocumentSymbolProvider, ExtensionContext, Location, LocationLink, Position, ProviderResult, SymbolInformation, TextDocument, languages, window, workspace } from "vscode"
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

class OrderDocumentSymbolProvider implements DocumentSymbolProvider {
    provideDocumentSymbols(document: TextDocument, token: CancellationToken): ProviderResult<SymbolInformation[] | DocumentSymbol[]> {
        let uri = document.uri
        let content = fs.readFileSync(uri.path).toString()
        order = parseOrder(content)
        return null
    }
}

export function registOrderProvider(extCtx: ExtensionContext) {
    let documentSelector = { pattern: '**/!out_shape_list' }
    extCtx.subscriptions.push(languages.registerDefinitionProvider(documentSelector, new OrderDefinitionProvider()))
    extCtx.subscriptions.push(languages.registerDocumentSymbolProvider(documentSelector, new OrderDocumentSymbolProvider()))
}