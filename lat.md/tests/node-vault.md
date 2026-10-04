---
lat:
  require-code-mention: true
---
# Node Vault Tests

Test specifications for the shared Node loader described in [[architecture#Monorepo layout]] that lists and reads markdown for the sidecar and the VS Code extension.

## Skips dot and ignored folders

Listing returns sorted relative paths and skips dot folders and any caller-supplied folder name at any depth.

## Reads frontmatter read-only

Reading a note returns its text, parsed frontmatter and a content hash without modifying the file.

## Reports broken frontmatter

A note with invalid YAML still returns its text, with null frontmatter and a one-line error message.

## No host imports

The loader sources import neither `obsidian` nor `vscode`, so every Node host can share them.
