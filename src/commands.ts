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

/**
 * Generates a macro name from UUID v4.
 *
 * @param preventDecimal If true, the returned string never starts with 0-9.
 * @returns Macro name. All upprecase. Separated by underscores.
 */
function fromGUID(preventDecimal: boolean): string {
    const uuidv4 = require('uuid/v4');
    let uuid = uuidv4();

    // Prevent a macro from starting with a decimal number.
    if (preventDecimal) {
        const digit = parseInt(uuid.substr(0, 1), 16);
        uuid = ((digit % 6) + 10).toString(16) + uuid.substr(1);
    }

    return uuid.toUpperCase().replace(/\-/g, '_');
}

/**
 * Generates a macro name from the file name or file path.
 *
 * @param fullPath If true, the returned string includes the path of current
 *                 document from the project root.
 *                 If false, only the file name is used.
 * @param shortenUnderscores If true, consecutive underscores are shortened into
 *                           one.
 * @param removeExtension If true, the file extension is not used.
 * @returns Macro name. All upprecase. All non-alphanumeric characters are
 *          replaced with underscores.
 */
function fromFileName(fullPath: boolean,
    pathDepth: number,
    shortenUnderscores: boolean,
    removeExtension: boolean): string {
    const editor = vscode.window.activeTextEditor;
    if (editor === undefined) {
        return '';
    }

    let documentUri = editor.document.uri;
    const baseUri = vscode.workspace.getWorkspaceFolder(documentUri);
    if (documentUri === undefined || baseUri === undefined) {
        return '';
    }

    let fileName = documentUri.toString().substr(baseUri.uri.toString().length + 1);

    const path = require('path');

    if (pathDepth > 0) {
        const arr = documentUri.toString().split("/");
        if (arr.length > pathDepth) {
            fileName = "";
            const startIndex = arr.length - pathDepth - 1;
            for (let index = startIndex; index < arr.length; index++) {
                fileName = fileName + "/" + arr[index];
            }
            // remove leading /
            fileName = fileName.substr(1);
        }
    }

    if (!fullPath) {
        fileName = path.basename(fileName);
    }

    if (removeExtension) {
        const extension = path.extname(fileName);
        fileName = fileName.substring(0, fileName.length - extension.length);
    }


    let macro = fileName.toUpperCase().replace(/[^A-Z0-9]/g, '_');
    if (shortenUnderscores) {
        macro = macro.replace(/_+/g, '_');
    }

    return macro;
}

/**
 * Generates include guard directives according to the configuration.
 *
 * @returns Array of strings like [ '#ifndef ...', '#define ...', '#endif ...' ].
 */
function createDirectives(): Array<string> {
    const config = vscode.workspace.getConfiguration('C/C++ Include Guard');
    const macroType = config.get<string>('Macro Type', 'GUID');
    const macroPrefix = config.get<string>('Prefix', '');
    const macroSuffix = config.get<string>('Suffix', '');
    const preventDecimal = config.get<boolean>('Prevent Decimal', true);
    const shortenUnderscores = config.get<boolean>('Shorten Underscores', true);
    const removeExtension = config.get<boolean>('Remove Extension', false);
    const commentStyle = config.get<string>('Comment Style', 'Block');
    const pathDepth = config.get<number>('Path Depth', -1);

    let macroName: string;
    if (macroType === 'Filename') {
        macroName = fromFileName(false, pathDepth, shortenUnderscores, removeExtension);
    }
    else if (macroType === 'Filepath') {
        macroName = fromFileName(true, pathDepth, shortenUnderscores, removeExtension);
    }
    else {
        macroName = fromGUID(preventDecimal);
    }

    macroName = macroPrefix + macroName + macroSuffix;

    let endifLine = '#endif /* ' + macroName + ' */\n';
    if (commentStyle === 'Line') {
        endifLine = '#endif // ' + macroName + '\n';
    }

    return [
        '#ifndef ' + macroName + '\n',
        '#define ' + macroName + '\n',
        endifLine
    ];
}

/**
 * Finds the line number just below the comment blocks at the beginning of the
 * current document.
 *
 * @returns Line number to insert the directives.
 */
function findLineToInsert(): number {
    const editor = vscode.window.activeTextEditor;
    if (editor === undefined) {
        return 0;
    }

    const document = editor.document;
    const text = document.getText();
    let lastPos = 0;
    for (; ;) {
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

/**
 * Finds the line numbers where the existing include guard directives are.
 *
 * @returns Array of line numbers.
 */
function findLinesToRemove(): Array<number> {
    const editor = vscode.window.activeTextEditor;
    if (editor === undefined) {
        return [];
    }

    const document = editor.document;
    const text = document.getText();
    const match1 = /^#ifndef\s+(\S+)\s*$/m.exec(text);
    const match2 = /^#define\s+(\S+)\s*$/m.exec(text);
    const match3_block = /^#endif\s+\/\*\s+(\S+)\s*\*\/\s*$/m.exec(text);
    const match3_line = /^#endif\s+\/\/\s+(\S+)\s*$/m.exec(text);

    let match3 = match3_block;
    if (match3_block === null && match3_line !== null) {
        match3 = match3_line;
    }

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

/**
 * Find pragma once and remove it from file.
 *
 * @returns Promise<boolean>
 */
async function findAndRemovePragmaOnce(): Promise<boolean> {
    const editor = vscode.window.activeTextEditor;
    if (editor === undefined) {
        return false;
    }

    const document = editor.document;
    const text = document.getText();

    const match = /^#pragma once*$/m.exec(text);
    if(match == null){
        return false;
    }
    const pos = document.positionAt(match.index).line;
    return editor.edit(function (edit) {
        // Remove line.
            edit.delete(lineToRange(pos));
    })
}

/**
 * Convert a line number into a range that represents a whole line including the
 * line ending.
 *
 * @param n Line number
 * @returns vscode.Range that represents a whole line.
 */
function lineToRange(n: number): vscode.Range {
    return new vscode.Range(
        new vscode.Position(n, 0), new vscode.Position(n + 1, 0));
}

// =============================================================================
//  Public command handlers
// =============================================================================

/**
 * Command Handler for 'extension.insertIncludeGuard'.
 * Insert new include guard directives into the current document.
 */
export async function insertIncludeGuard() : Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (editor === undefined) {
        return;
    }

    const config = vscode.workspace.getConfiguration('C/C++ Include Guard');
    const skipComment = config.get<boolean>('Skip Comment Blocks', true);
    const insertBlankLine = config.get<boolean>('Insert Blank Line', true);
    const removePragmaOnce = config.get<boolean>('Remove Pragma Once', true);

    if(removePragmaOnce){
        await findAndRemovePragmaOnce();
    }

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
        if (lineToInsert !== 0 && insertBlankLine) {
            directives[0] = '\n' + directives[0];
        }
        edit.insert(new vscode.Position(lineToInsert, 0), directives[0] + directives[1]);
        edit.insert(new vscode.Position(document.lineCount, 0), directives[2]);
    });
}

/**
 * Command Handler for 'extension.removeIncludeGuard'.
 * Remove existing include guard directives from the current document.
 */
export async function removeIncludeGuard(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (editor === undefined) {
        return;
    }

    const config = vscode.workspace.getConfiguration('C/C++ Include Guard');
    const removePragmaOnce = config.get<boolean>('Remove Pragma Once', true);

    if(removePragmaOnce){
        await findAndRemovePragmaOnce();
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

/**
 * Command Handler for 'extension.updateIncludeGuard'.
 * Replace existing include guard directives with new ones.
 */
export async function updateIncludeGuard(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (editor === undefined) {
        return;
    }
    
    const config = vscode.workspace.getConfiguration('C/C++ Include Guard');
    const removePragmaOnce = config.get<boolean>('Remove Pragma Once', true);

    if(removePragmaOnce){
        await findAndRemovePragmaOnce();
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
