/**
 * Copyright (c) 2019 Akira Miyakoda
 *
 * This software is released under the MIT License.
 * https://opensource.org/licenses/MIT
 */

import * as vscode from 'vscode';

// =============================================================================
//  Internal functions
// =============================================================================

// Create a macro name from UUID v4.
function fromGUID(preventDecimal: boolean) : string
{
    const uuidv4 = require('uuid/v4');
    let uuid = uuidv4();

    // Prevent a macro from starting with a decimal number.
    if (preventDecimal) {
        const digit = parseInt(uuid.substr(0, 1), 16);
        uuid = ((digit % 6) + 10).toString(16) + uuid.substr(1);
    }

    return uuid.toUpperCase().replace(/\-/g, '_');
}

// Create a macro name from the file name or file path.
function fromFileName(fullPath: boolean, shortenUnderscores: boolean) : string
{
    const editor = vscode.window.activeTextEditor;
    if (editor === undefined) {
        return '';
    }

    const documentUri = editor.document.uri;
    const baseUri = vscode.workspace.getWorkspaceFolder(documentUri);
    if (documentUri === undefined || baseUri === undefined) {
        return '';
    }

    let fileName = documentUri.toString().substr(baseUri.uri.toString().length + 1);
    if (!fullPath) {
        const path = require('path');
        fileName = path.basename(fileName);
    }

    let macro = fileName.toUpperCase().replace(/[^A-Z0-9]/g, '_');
    if (shortenUnderscores) {
        macro = macro.replace(/_+/g, '_');
    }

    return macro;
}

// Generate include guard directives according to the preferences.
function createDirectives() : Array<string>
{
    const config = vscode.workspace.getConfiguration('C/C++ Include Guard');
    const macroType          = config.get<string >('Macro Type',          'GUID');
    const macroPrefix        = config.get<string >('Prefix',              '');
    const macroSuffix        = config.get<string >('Suffix',              '');
    const preventDecimal     = config.get<boolean>('Prevent Decimal',     true);
    const shortenUnderscores = config.get<boolean>('Shorten Underscores', true);

    let macroName : string;
    if (macroType === 'Filename') {
        macroName = fromFileName(false, shortenUnderscores);
    }
    else if (macroType === 'Filepath') {
        macroName = fromFileName(true, shortenUnderscores);
    }
    else {
        macroName = fromGUID(preventDecimal);
    }

    macroName = macroPrefix + macroName + macroSuffix;

    return [
        '#ifndef '   + macroName + '\n',
        '#define '   + macroName + '\n',
        '#endif /* ' + macroName + ' */\n'
    ];
}

// Find the line below the first comment blocks to insert an include guard.
function findLineToInsert() : number
{
    const editor = vscode.window.activeTextEditor;
    if (editor === undefined) {
        return 0;
    }

    const document = editor.document;
    const text = document.getText();
    let lastPos = 0;
    for (;;) {
        const match = /\/\/.*$|\/(?!\\)\*[\s\S]*?\*(?!\\)\//m.exec(text.substr(lastPos));
        if (match !== null) {
            if (/\S/.test(text.substr(lastPos, match.index))) {
                break;
            }
            else {
                lastPos += (match.index + match[0].length);
            }
        }
        else {
            break;
        }
    }

    if (lastPos === 0) {
        return 0;
    }
    else {
        return document.positionAt(lastPos).line + 1;
    }
}

// Find the positions of existing include guard directives.
function findLinesToRemove() : Array<number>
{
    const editor = vscode.window.activeTextEditor;
    if (editor === undefined) {
        return [];
    }

    const document = editor.document;
    const text = document.getText();
    const match1 = /^#ifndef\s+(\S+)\s*$/m.exec(text);
    const match2 = /^#define\s+(\S+)\s*$/m.exec(text);
    const match3 = /^#endif\s+\/\*\s+(\S+)\s*\*\/\s*$/m.exec(text);

    if (match1 === null || match2 === null || match3 === null) {
        return [];
    }

    if (match1[1] !== match2[1] || match2[1] !== match3[1]) {
        return [];
    }

    if (match1.index > match2.index || match2.index > match3.index) {
        return [];
    }

    return [
        document.positionAt(match1.index).line,
        document.positionAt(match2.index).line,
        document.positionAt(match3.index).line
    ];
}

// Create a range that represents a whole line.
function lineToRange(n: number) : vscode.Range
{
    return new vscode.Range(
        new vscode.Position(n, 0), new vscode.Position(n + 1, 0));
}

// =============================================================================
//  Public command handlers
// =============================================================================

// Insert new include guard macros.
export function insertIncludeGuard() : void
{
    const editor = vscode.window.activeTextEditor;
    if (editor === undefined) {
        return;
    }

    const config = vscode.workspace.getConfiguration('C/C++ Include Guard');
    const skipComment = config.get<boolean>('Skip Comment Blocks', true);

    let lineToInsert = 0;
    if (skipComment) {
        lineToInsert = findLineToInsert();
    }

    editor.edit(function (edit) {
        // Ensure the last line has an line ending.
        const document = editor.document;
        const bottomLine = document.lineAt(document.lineCount - 1).text;
        if (bottomLine.length !== 0) {
            edit.insert(new vscode.Position(document.lineCount, 0), '\n');
        }

        // Insert include guard directives.
        const directives = createDirectives();
        edit.insert(new vscode.Position(lineToInsert, 0), directives[0] + directives[1]);
        edit.insert(new vscode.Position(document.lineCount, 0), directives[2]);
    });
}

// Remove old include guard macros.
export function removeIncludeGuard() : void
{
    const editor = vscode.window.activeTextEditor;
    if (editor === undefined) {
        return;
    }

    // If include guard directives have been found ...
    const linesToRemove = findLinesToRemove();
    if (linesToRemove.length !== 0) {
        editor.edit(function (edit) {
            // Remove them.
            for (let i = 0; i < 3; ++i) {
                edit.delete(lineToRange(linesToRemove[i]));
            }
        });
    }
}

// Insert or Update include guard macros.
export function updateIncludeGuard() : void
{
    const editor = vscode.window.activeTextEditor;
    if (editor === undefined) {
        return;
    }

    // If include guard directives have been found ...
    const linesToRemove = findLinesToRemove();
    if (linesToRemove.length !== 0) {
        editor.edit(function (edit) {
            // Replace them with new ones.
            const directives = createDirectives();
            for (let i = 0; i < 3; ++i) {
                edit.replace(lineToRange(linesToRemove[i]), directives[i]);
            }
        });
    }
    else {
        // Or just insert the new directives if old ones have not been found.
        insertIncludeGuard();
    }
}
