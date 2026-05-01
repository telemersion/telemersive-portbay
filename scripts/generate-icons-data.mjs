#!/usr/bin/env node
// Generates docs/design/icons-data.js from src/renderer/assets/icons.ts.
// The design reference HTML is opened via file:// and cannot use ESM imports,
// so we mirror the icon definitions as a classic <script> file.
//
// Run after editing src/renderer/assets/icons.ts:
//   npm run gen:icons-data

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const srcPath = resolve(here, '../src/renderer/assets/icons.ts')
const outPath = resolve(here, '../docs/design/icons-data.js')

const src = readFileSync(srcPath, 'utf8')

// icons.ts is pure JS today (no type annotations). Strip `export ` so the file
// becomes a classic script that defines globals on window.
const body = src.replace(/^export\s+const\s+/gm, 'const ')

const banner = `// AUTO-GENERATED from src/renderer/assets/icons.ts — do not edit by hand.
// Regenerate via: npm run gen:icons-data
`

const footer = `
window.ICON_PATHS = ICON_PATHS
window.ICON_COMPOSITES = ICON_COMPOSITES
`

writeFileSync(outPath, banner + body + footer)
console.log(`wrote ${outPath}`)
