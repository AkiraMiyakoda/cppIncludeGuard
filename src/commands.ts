import * as vscode from 'vscode';

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

function fromFileName(fullPath: boolean) : string
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

    return fileName.toUpperCase().replace(/[^A-Z0-9]/g, '_');
}

function createDirectives()
{
    const config = vscode.workspace.getConfiguration('C/C++ Include Guard');
    const macroType   = config.get<string>('Macro Type',      'GUID');
    const macroPrefix = config.get<string>('Prefix',          '');
    const macroSuffix = config.get<string>('Suffix',          '');
    const noDecimal   = config.get<boolean>('Prevent Decimal', true);
    
    let macroName : string;
    if (macroType === 'Filename') {
        macroName = fromFileName(false);
    }   
    else if (macroType === 'Filepath') {
        macroName = fromFileName(true);
    }
    else {
        macroName = fromGUID(noDecimal);
    }

    macroName = macroPrefix + macroName + macroSuffix;

    return {
        'begin': '#ifndef ' + macroName + '\n#define ' + macroName + '\n',
        'end':   '#endif /* ' + macroName + ' */\n',
    };
}

export function insertIncludeGuard()
{
    const editor = vscode.window.activeTextEditor;
    if (editor === undefined) {
        return;
    }

    editor.edit(function (edit) {
        // Ensure the last line has an line ending.
        const document = editor.document;
        const lastLine = document.lineAt(document.lineCount - 1);
        if (!lastLine.isEmptyOrWhitespace) {
            edit.insert(new vscode.Position(document.lineCount, 0), '\n');
        }

        // Insert include guard directives.
        const directives = createDirectives();
        edit.insert(new vscode.Position(0, 0), directives['begin']);
        edit.insert(new vscode.Position(document.lineCount, 0), directives['end']);
    });
}
