/**
 * Copyright (c) 2019 Akira Miyakoda
 *
 * This software is released under the MIT License.
 * https://opensource.org/licenses/MIT
 */

import * as vscode from "vscode";
import * as commands from "./commands";

export function activate(context: vscode.ExtensionContext): void {
  console.log(
    'Congratulations, your extension "cppIncludeGuard" is now active!'
  );

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
            if (vscode.workspace.getConfiguration("C/C++ Include Guard").get<boolean>("Auto Include Guard Insertion For New File"))
            {
                const headerExtensions = [".h", ".hpp", ".h++", ".hh"];
                for (const newFile of event.files)
                {
                    for (const headerExtension of headerExtensions)
                    {
                        if (newFile.fsPath.endsWith(headerExtension))
                        {
                            vscode.workspace.openTextDocument(newFile).then(doc =>
                                vscode.window.showTextDocument(doc).then(commands.insertIncludeGuard)
                            );
                            break;
                        }
                    }
                }
            }
        }
    );
}
