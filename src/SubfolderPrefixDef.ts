/**
 * Interface for the "Prefix for Subfolder" setting. Setting
 * is an array of SubfolderPrefixDef objects.
 */
interface SubfolderPrefixDef {
  /**
   * The prefix for the subfolder.
   * @type {string}
   * @memberof SubfolderPrefixDef
   * @description The path of the subfolder relative to the workspace root.
   */
  folderPath: string;
  /**
   * The prefix for the subfolder.
   * @type {string}
   * @memberof SubfolderPrefixDef
   * @description The prefix used when the file is in the subfolder.
   */
  prefix: string;
}

export { SubfolderPrefixDef };
