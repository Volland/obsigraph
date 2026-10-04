// The stateless file-reading half lives in the shared package so the VS Code extension does not carry a copy.
export { isNotePath, listMarkdown, readNote, toVaultPath, listFiles, type FileInfo, type ListFilesOptions, type ListOptions, type ReadNote } from '@obsigraph/node-vault';
