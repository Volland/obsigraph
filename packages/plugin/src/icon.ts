import { addIcon } from 'obsidian';

export const TG_ICON = 'typed-graph';

// Obsidian icon SVGs use a 0 0 100 100 viewBox; the letters are strokes so they don't depend on a font.
const TG_SVG = `<g fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
  <rect x="8" y="8" width="84" height="84" rx="18"/>
  <path d="M17 32H39M28 32V68"/>
  <path d="M74.3 38.7A16 16 0 1 0 79 50H64"/>
</g>`;

// @tg: implements:: [[visualization#Surfaces]] {since: "2026-10-11"}
// @lat: [[visualization#Surfaces]]
export function registerTgIcon(): void {
  addIcon(TG_ICON, TG_SVG);
}
