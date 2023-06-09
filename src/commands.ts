/**
 * Copyright (c) 2019 Akira Miyakoda
 *
 * This software is released under the MIT License.
 * https://opensource.org/licenses/MIT
 */

import * as vscode from "vscode";
import { v4 as uuidv4 } from "uuid";
import * as path from "path";
import { getConfig } from "./common";
import { SubfolderPrefixDef } from "./SubfolderPrefixDef";

// =============================================================================
//  Internal functions
// =============================================================================

/**
 * Generates a macro name from UUID v4.
 *
 * @param preventDecimal If true, the returned string never starts with 0-9.
 * @returns Macro name. All uppercase. Separated by underscores.
 */
function fromGUID(preventDecimal: boolean): string {
  let uuid = uuidv4();

  // Prevent a macro from starting with a decimal number.
  if (preventDecimal) {
    const digit = parseInt(uuid.substr(0, 1), 16);
    uuid = ((digit % 6) + 10).toString(16) + uuid.substr(1);
  }

  return uuid.toUpperCase().replace(/-/g, "_");
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
 * @param convertPathToSnakeCase If true, the file name is converted from camelCase/PascalCase to snake_case.
 * @returns Macro name. All uppercase. All non-alphanumeric characters are
 *          replaced with underscores.
 */
function fromFileName(
  fullPath: boolean,
  pathDepth: number,
  pathSkip: number,
  shortenUnderscores: boolean,
  removeExtension: boolean,
  convertPathToSnakeCase: boolean
): string {
  const editor = vscode.window.activeTextEditor;
  if (editor === undefined) {
    return "";
  }

  const documentUri = editor.document.uri;
  const baseUri = vscode.workspace.getWorkspaceFolder(documentUri);
  if (documentUri === undefined) {
    return "";
  }

  let fileName = documentUri.toString();
  if (fullPath && baseUri !== undefined) {
    // Convert to path relative to baseUri
    fileName = fileName.substr(baseUri.uri.toString().length + 1);

    if (pathDepth > 0 || pathSkip > 0 || convertPathToSnakeCase) {
      const folderSep = "/";
      let pathSegments = fileName.split(folderSep);

      // Discard the first pathSkip segments (but always keep at least one!)
      pathSegments = pathSegments.slice(Math.min(pathSkip, pathSegments.length - 1));

      if(pathDepth > 0) {
        // Keep only the last pathDepth folders and the file segment
        pathSegments = pathSegments.slice(-(pathDepth + 1));
      }

      if(convertPathToSnakeCase) {
        pathSegments = pathSegments.map(convertPascalCaseToSnakeCase);
      }

      fileName = pathSegments.join(folderSep);
    }
  } else {
    fileName = path.basename(fileName);
    if(convertPathToSnakeCase) {
      fileName = convertPascalCaseToSnakeCase(fileName);
    }
  }

  if (removeExtension) {
    const extension = path.extname(fileName);
    fileName = fileName.substring(0, fileName.length - extension.length);
  }

  let macro = fileName.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  if (shortenUnderscores) {
    macro = macro.replace(/_+/g, "_");
  }

  return macro;
}

function convertPascalCaseToSnakeCase(str: string): string {
  // CamelCase to snake_case
  str = str.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
  // PascalCase to snake_case
  str = str.replace(/([A-Z])([A-Z][a-z])/g, "$1_$2").toLowerCase();
  return str;
}

function getSubdirectoryPrefix(subfolderPrefixDefs: SubfolderPrefixDef[]): string {
  if(subfolderPrefixDefs.length === 0) {
    return "";
  }

  const editor = vscode.window.activeTextEditor;
  if (editor === undefined) {
    return "";
  }

  const documentUri = editor.document.uri;
  const baseUri = vscode.workspace.getWorkspaceFolder(documentUri);
  if (documentUri === undefined
    || baseUri === undefined) {
    return "";
  }

  // Loop over subfolderPrefixDefs
  for (const subfolderPrefixDef of subfolderPrefixDefs) {
    // Check if the document is in the subfolder
    const subfolderPath = path.join(baseUri.uri.fsPath, subfolderPrefixDef.folderPath);
    const documentPath = documentUri.fsPath;
    if (documentPath.startsWith(subfolderPath)) {
      return subfolderPrefixDef.prefix;
    }
  }

  return "";
}

/**
 * Generates include guard directives according to the configuration.
 *
 * @returns Array of strings like [ '#ifndef ...', '#define ...', '#endif ...' ].
 */
function createDirectives(fileUri: vscode.Uri): Array<string> {
  const config = getConfig(fileUri);
  const macroType = config.get<string>("Macro Type", "GUID");
  const macroPrefix = config.get<string>("Prefix", "");
  const macroSubfolderPrefixDefs = config.get<SubfolderPrefixDef[]>("Subfolder Prefixes", []);
  const macroSuffix = config.get<string>("Suffix", "");
  const preventDecimal = config.get<boolean>("Prevent Decimal", true);
  const shortenUnderscores = config.get<boolean>("Shorten Underscores", true);
  const removeExtension = config.get<boolean>("Remove Extension", false);
  const commentStyle = config.get<string>("Comment Style", "Block");
  const pathDepth = config.get<number>("Path Depth", 0);
  const pathSkip = config.get<number>("Path Skip", 0);
  const spacesAfterEndif = config.get<number>("Spaces After Endif", 1);
  const convertPathToSnakeCase = config.get<boolean>("File Path Pascal Case to Snake Case", false);

  let macroName: string;
  if (macroType !== "GUID") {
    macroName = fromFileName(
      (macroType === "Filepath"),
      pathDepth,
      pathSkip,
      shortenUnderscores,
      removeExtension,
      convertPathToSnakeCase
    );
    if (macroType === "Filename and GUID") {
      macroName += "_" + fromGUID(preventDecimal);
    }
  } else {
    macroName = fromGUID(preventDecimal);
  }

  const macroSubfolderPrefix : string = getSubdirectoryPrefix(macroSubfolderPrefixDefs);

  macroName = macroPrefix + macroSubfolderPrefix + macroName + macroSuffix;
  const spaces = " ".repeat(spacesAfterEndif);

  let endifLine = "#endif";
  if (commentStyle === "Block") {
    endifLine += spaces + "/* " + macroName + " */";
  } else if (commentStyle === "Line") {
    endifLine += spaces + "// " + macroName;
  }

  return [
    "#ifndef " + macroName + "\n",
    "#define " + macroName + "\n",
    endifLine + "\n",
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
  for (;;) {
    const match = /\/\/.*$|\/(?!\\)\*[\s\S]*?\*(?!\\)\//m.exec(
      text.substr(lastPos)
    );
    if (match !== null) {
      if (/\S/.test(text.substr(lastPos, match.index))) {
        break;
      } else {
        lastPos += match.index + match[0].length;
      }
    } else {
      break;
    }
  }

  if (lastPos === 0) {
    return 0;
  } else {
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
  const match3_none = [...text.matchAll(/^#endif\s*$/gm)];

  let match3Index;
  let match3Macro;
  if (match3_block !== null) {
    match3Index = match3_block.index;
    match3Macro = match3_block[1];
  } else if (match3_line !== null) {
    match3Index = match3_line.index;
    match3Macro = match3_line[1];
  } else if (match3_none.length > 0) {
    match3Index = match3_none[match3_none.length - 1].index;
  } else {
    return [];
  }

  if (!match1 || !match2 || match3Index === undefined) {
    return [];
  }

  if (match1[1] !== match2[1]) {
    return [];
  }

  if (match3Macro !== undefined && match2[1] !== match3Macro) {
    return [];
  }

  if (match1.index > match2.index || match2.index > match3Index) {
    return [];
  }

  return [
    document.positionAt(match1.index).line,
    document.positionAt(match2.index).line,
    document.positionAt(match3Index).line,
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
  if (match === null) {
    return false;
  }
  const pos = document.positionAt(match.index).line;
  return editor.edit(function (edit) {
    // Remove line.
    edit.delete(lineToRange(pos));
  });
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
    new vscode.Position(n, 0),
    new vscode.Position(n + 1, 0)
  );
}

// =============================================================================
//  Public command handlers
// =============================================================================

/**
 * Command Handler for 'extension.insertIncludeGuard'.
 * Insert new include guard directives into the current document.
 */
export async function insertIncludeGuard(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (editor === undefined) {
    return;
  }
  //add 2 lines of delta to current cursor position, which will be the position after adding include guard
  const cursorPosition = editor.selection.active.translate(2);

  const config = getConfig(editor.document.uri);
  const skipComment = config.get<boolean>("Skip Comment Blocks", true);
  const insertBlankLine = config.get<boolean>("Insert Blank Line", true);
  const removePragmaOnce = config.get<boolean>("Remove Pragma Once", true);

  if (removePragmaOnce) {
    await findAndRemovePragmaOnce();
  }

  let lineToInsert = 0;
  if (skipComment) {
    lineToInsert = findLineToInsert();
  }

  await editor.edit(function (edit) {
    // Ensure the last line has an line ending.
    const document = editor.document;
    const bottomLine = document.lineAt(document.lineCount - 1).text;
    if (bottomLine.length !== 0) {
      edit.insert(new vscode.Position(document.lineCount, 0), "\n");
    }

    // Insert include guard directives.
    const directives = createDirectives(document.uri);
    if (lineToInsert !== 0 && insertBlankLine) {
      directives[0] = "\n" + directives[0];
    }
    edit.insert(
      new vscode.Position(lineToInsert, 0),
      directives[0] + directives[1]
    );
    edit.insert(new vscode.Position(document.lineCount, 0), "\n\n" + directives[2]);//add 2 extra blank lines before #endif -> issue #8
  });
  editor.selection = new vscode.Selection(cursorPosition, cursorPosition); //move back cursor to the original position -> issue #8
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

  const config = getConfig(editor.document.uri);
  const removePragmaOnce = config.get<boolean>("Remove Pragma Once", true);

  if (removePragmaOnce) {
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
export async function updateIncludeGuard(insertWhenNotFound = true): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (editor === undefined) {
    return;
  }

  const config = getConfig(editor.document.uri);
  const removePragmaOnce = config.get<boolean>("Remove Pragma Once", true);

  if (removePragmaOnce && insertWhenNotFound) {
    await findAndRemovePragmaOnce();
  }

  // If include guard directives have been found ...
  const linesToRemove = findLinesToRemove();
  if (linesToRemove.length !== 0) {
    editor.edit(function (edit) {
      // Replace them with new ones.
      const directives = createDirectives(editor.document.uri);
      for (let i = 0; i < 3; ++i) {
        edit.replace(lineToRange(linesToRemove[i]), directives[i]);
      }
    });
  } else {
    // Or just insert the new directives if old ones have not been found.
    if(insertWhenNotFound)
      insertIncludeGuard();
  }
}
