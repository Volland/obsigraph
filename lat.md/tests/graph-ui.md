---
lat:
  require-code-mention: true
---
# Graph UI Tests

Test specifications for the shared renderer package described in [[visualization#Surfaces]] that the Obsidian plugin and the VS Code extension both use.

## Theme supplied by host

The style sheet takes its text and background colors from the theme the host passes in and reads no host global.

## Negative edge looks the same

A negative edge always gets a tee arrow in the shared style sheet, whichever host draws it; its dashed red default comes from the shared styler.

## Graph UI has no host imports

The shared renderer sources import neither `obsidian` nor `vscode`.
