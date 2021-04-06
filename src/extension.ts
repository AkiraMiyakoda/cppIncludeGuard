/**
 * Copyright (c) 2019 Akira Miyakoda
 *
 * This software is released under the MIT License.
 * https://opensource.org/licenses/MIT
 */

import * as vscode from "vscode";
import * as commands from "./commands";

/**
 * Helper function for getting the config for this extension
 */
function getConfig()
{
    return vscode.workspace.getConfiguration("C/C++ Include Guard");
}

/**
 * Check if the file is a header file
 * @param file Uri of a file
 */
function isHeader(file: vscode.Uri) : boolean
{
    const headerExtensions = [".h", ".hpp", ".h++", ".hh"];
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
function shouldUpdateGuard()
{
    if (getConfig().get<boolean>("Auto Update Include Guard"))
    {
        const macroType = getConfig().get<string>("Macro Type", "GUID");
        if (macroType === "Filename" || macroType === "Filepath") //only effective when the macro type is either "Filename" or "Filepath"
            return true;
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
            if (getConfig().get<boolean>("Auto Include Guard Insertion For New File"))
            {
                for (const newFile of event.files)
                {
                    if (isHeader(newFile))
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
        if (shouldUpdateGuard())
        {
            for (const renamedFile of event.files)
            {
                if (isHeader(renamedFile.newUri) && isOpenedInEditor(renamedFile.newUri))
                    commands.updateIncludeGuard(); //Do insert include guard when there is none found, because user explicitly rename the file
            }
        }
    });
    //When the file is not currently shown in text editor, it should be automatically updated when it is opened
    vscode.workspace.onDidOpenTextDocument(async document =>
    {
        if (shouldUpdateGuard() && isHeader(document.uri))
        {
            await commands.updateIncludeGuard(false);
                                                //^ Do not insert include guard when there is none found
        }
    });
}