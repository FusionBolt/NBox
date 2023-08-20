

// 1. check current il is in test
// 2. show icon to run

import { ExtensionContext, Range, Uri, WorkspaceConfiguration, commands, window, workspace } from "vscode";
import * as vscode from "vscode";
import { LanguageClient } from "vscode-languageclient/node";
import { getVSCodeDownloadUrl } from "@vscode/test-electron/out/util";
import * as path from 'path';
import * as fs from 'fs';

function isInTest(path: string) {
    return path.includes("tests_output")
}

function getPathInfo(filepath: string) {
    // todo: nncase test and 510 test, add config in settings.json
    if(!isInTest(filepath)) {
        return undefined
    }
    return parseTest(filepath)
}


function getNncaseRoot() {
    let nnboxConfig = vscode.workspace.getConfiguration('NNBox')
    let r = nnboxConfig.get<string>("nncaseRootDir")
    return r == undefined ? "" : r
}

function getCustomCommand() {
    let nnboxConfig = vscode.workspace.getConfiguration('NNBox')
    let r = nnboxConfig.get<string>("gotoCommand")
    return r == undefined ? "" : r
}

function parseTest(path: string) {
    var nncaseRoot = getNncaseRoot()
    let data = path.split("/")
    let beginIndex = data.indexOf("tests_output")
    let testClass = data[beginIndex + 1]
    let testMethod = data[beginIndex + 2]
    let searchRoot = data.slice(0, beginIndex).join("/")
    return [testClass, testMethod, nncaseRoot == "" ? searchRoot : nncaseRoot]
}


// todo: change this
let terminal = window.createTerminal("dotnet test")
export function registTestProvider(context: ExtensionContext, client: LanguageClient) {
    function registerCommand(
        command: string,
        callback: (...args: any[]) => unknown
    ) {
        context.subscriptions.push(commands.registerCommand(command, callback));
    }

    registerCommand("goto.nnbox", (param) => {
        // 很难辨别啊，都是test开头的么，如果是这样还能做，如果不是就做不了（那就不跳转，识别不了，提示message
        let info = getPathInfo(param.path)
        if(info == undefined) {
            return undefined
        }
        let [testClass, testMethod, root] = info
        let fileList = lookup(path.join(root, "src", "Nncase.Tests"), s => {
            return s == `${testClass}.cs`
        })
        if(fileList.length == 0) {
            window.showWarningMessage(`Class Not Found ${testClass}`)
            return undefined
        }
        
        if(fileList.length > 1) {
            // todo: need resolve
        }

        let file = fileList[0]
        var content = fs.readFileSync(file).toString()
        var lines = content.split("\n");
        // filter / find index, maybe same name
        var methods = lines.filter(s => s.includes(`public void ${testMethod}(`)).map(x => lines.indexOf(x))
        var line = 0
        if(methods.length == 1) {
            line = methods[0]
        } else if(methods.length > 1) {
            // todo: need resolve
            line = methods[0]
        }

        // search method name and goto line
        let customCmd = getCustomCommand()
        if(customCmd != "") {
            let cmd = customCmd.replace("$0", line.toString()).replace("$1", file)
            const cp = require('child_process')
            cp.exec(cmd);
        } else {
            workspace.openTextDocument(file).then((textDocument) => {
                const range = new Range(
                    line,
                    0,
                    line,
                    0
                  );
                window.showTextDocument(textDocument, {
                    selection: range
                })
            })
        }
    })

    registerCommand("runTest.nnbox", (param) => {
        let info = getPathInfo(param.path)
        if(info == undefined) {
            return undefined
        }
        let [testClass, testMethod, root] = info
        terminal.show()
        let cmd = `cd ${root} && dotnet test --filter DisplayName~${testClass}.${testMethod}`
        terminal.sendText(cmd)
    })

    registerCommand("github.nncase.nnbox", (param) => {
        vscode.env.openExternal(vscode.Uri.parse('https://github.com/kendryte/nncase'));
    })
}

export function lookup(dir: string, f: ((path: string) => boolean)): string[] {
    const results: string[] = [];
    const findFiles = (dir: string) => {
        const files = fs.readdirSync(dir);
      
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stat = fs.lstatSync(filePath);
      
          if (stat.isDirectory()) {
            findFiles(filePath); 
          } else if (f(file)) {
            results.push(filePath);
          }
        }
      }
    findFiles(dir)
    return results
}