import * as vscode from "vscode";

/**
 * Helper function for getting the config for this extension for a resource.
 * @returns The config for this extension
 * @param resourceUri The uri of the resource we are getting the config for.
 */
export function getConfig(resourceUri: vscode.Uri) : vscode.WorkspaceConfiguration
{
    return vscode.workspace.getConfiguration("C/C++ Include Guard", resourceUri);
}

/**
 * Helper function for getting the config for this extension in window scope.
 * @returns The config for this extension
 */
export function getWindowConfig() : vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration("C/C++ Include Guard");
}
