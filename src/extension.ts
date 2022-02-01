/**
 * Copyright (c) 2019 Akira Miyakoda
 *
 * This software is released under the MIT License.
 * https://opensource.org/licenses/MIT
 */

import * as vscode from "vscode";
import * as commands from "./commands";
import { getConfig } from "./common";

/**
 * Check if the file is a header file
 * @param file Uri of a file
 */
function isHeader(file: vscode.Uri) : boolean
{
    const headerExtensions = getConfig(file).get<string[]>("Header Extensions", [".h", ".hpp", ".h++", ".hh"]);
    return headerExtensions.some(headerExtension => file.fsPath.endsWith(headerExtension));
}

/**
 * Check if a file is currently shown in the editor
 * @param file Uri of the file
 */
function isOpenedInEditor(file: vscode.Uri) : boolean
{
    return vscode.window.visibleTextEditors.some(editor => editor.document.uri.toString() === file.toString());
}

/**
 * Determine whether automatic updating include guard when renaming the file is enabled
 */
function shouldUpdateGuard(file: vscode.Uri)
{
    if (!getConfig(file).get<boolean>("Auto Update Include Guard"))
    {
        return false;
    }

    const macroType = getConfig(file).get<string>("Macro Type", "GUID");
    if (macroType === "Filename" || macroType === "Filepath") { //only effective when the macro type is either "Filename" or "Filepath"
        if(shouldAutoIncludeGuardInFile(file)) {
            return true;
        }
    }

    return false;
}

/**
 * Determine whether the include guard should be automatically included.
 * @param file Uri of the file
 * @return true if the include guard should be automatically included, false otherwise
 */
function shouldAutoIncludeGuardInFile(file: vscode.Uri): boolean {
    const baseUri = vscode.workspace.getWorkspaceFolder(file);
    if (baseUri === undefined) {
        // Allowlist and blocklist are relative to workspace root. If workspace uri is not found,
        // assume we shouldn't auto update include guard.
        return false;
    }

    const allowlist: string[] = getConfig(file).get<string[]>("Auto Update Path Allowlist", []);
    const blocklist: string[] = getConfig(file).get<string[]>("Auto Update Path Blocklist", []);

    // If the allowlist is empty, assume all files are included in the allowlist.
    // Allowlist and blocklist are relative to the workspace root. Need to
    // take workspace root into account, since the workspace root is not
    // included in the allowlist and blocklist paths.
    const relativePath = file.toString().substring(baseUri.uri.toString().length + 1);
    if (allowlist.length === 0 || allowlist.some(path => relativePath.startsWith(path))) {
        // If the file is in the allowlist, or the allowlist is empty,
        // check if the file is in the blocklist.
        if(!blocklist.some(path => relativePath.startsWith(path))) {
            return true;
        }
    }

    return false;
}

export function activate(context: vscode.ExtensionContext) {

  context.subscriptions.push(
    vscode.commands.registerCommand("extension.insertIncludeGuard", () =>
      commands.insertIncludeGuard()
    ),
    vscode.commands.registerCommand("extension.removeIncludeGuard", () =>
      commands.removeIncludeGuard()
    ),
    vscode.commands.registerCommand("extension.updateIncludeGuard", () =>
      commands.updateIncludeGuard()
    )
  );

    /*When adding a new header file, automatically invoke insertIncludeGuard() */
    vscode.workspace.onDidCreateFiles(
        async (event) =>
        {
            for (const newFile of event.files)
            {
                if(getConfig(newFile).get<boolean>("Auto Include Guard Insertion For New File", true)) {
                    if (shouldAutoIncludeGuardInFile(newFile)
                        && isHeader(newFile))
                    {
                        vscode.workspace.openTextDocument(newFile).then(doc =>
                            vscode.window.showTextDocument(doc).then(commands.insertIncludeGuard)
                        );
                    }
                }
            }
        }
    );

    /*When renaming a header file and the macro type is Filename, update the macro accordingly*/
    //This event will fire when moving the file & renaming the file
    vscode.workspace.onDidRenameFiles(event =>
    {
        for (const renamedFile of event.files)
        {
            if (shouldUpdateGuard(renamedFile.newUri))
            {
                if (isHeader(renamedFile.newUri) && isOpenedInEditor(renamedFile.newUri))
                    commands.updateIncludeGuard(); //Do insert include guard when there is none found, because user explicitly rename the file
            }
        }
    });
    //When the file is not currently shown in text editor, it should be automatically updated when it is opened
    vscode.workspace.onDidOpenTextDocument(async document =>
    {
        if (shouldUpdateGuard(document.uri) && isHeader(document.uri))
        {
            await commands.updateIncludeGuard(false);
                                                //^ Do not insert include guard when there is none found
        }
    });
}