/**
 * Copyright (c) 2019 Akira Miyakoda
 *
 * This software is released under the MIT License.
 * https://opensource.org/licenses/MIT
 */

import * as vscode from "vscode";
import commands = require("./commands");

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
}

// this method is called when your extension is deactivated
export function deactivate(): void {
  return;
}
