#!/usr/bin/env node
// Parses the "Do Not Contact List" markdown table out of BDR/CLAUDE.md
// and writes data/seed/dnc.json so the app can seed the dnc table on first run.
//
// Run: node scripts/extract-dnc.mjs [path-to-BDR-CLAUDE.md]
// Default path: ../BDR/CLAUDE.md (sibling repo).

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const claudeMdPath = resolve(here, '..', process.argv[2] || '../BDR/CLAUDE.md');
const outPath = resolve(here, '..', 'data/seed/dnc.json');

const md = readFileSync(claudeMdPath, 'utf8');

// Find the section starting with "## Do Not Contact List" and ending at the next "##" heading.
const start = md.indexOf('## Do Not Contact List');
if (start === -1) {
  console.error('Could not find "## Do Not Contact List" section in', claudeMdPath);
  process.exit(1);
}
const end = md.indexOf('\n## ', start + 1);
const block = md.slice(start, end === -1 ? md.length : end);

// Pull markdown table rows: "| Name | Company | Reason | Date |"
const rows = block
  .split('\n')
  .filter((line) => line.startsWith('|') && !line.includes('---'))
  .map((line) =>
    line
      .replace(/^\||\|$/g, '')
      .split('|')
      .map((c) => c.trim())
  )
  .filter((cells) => cells.length === 4 && cells[0] !== 'Name');

const dnc = rows.map(([name, company, reason, date]) => ({ name, company, reason, date }));

writeFileSync(outPath, JSON.stringify(dnc, null, 2));
console.log(`wrote ${dnc.length} DNC entries to ${outPath}`);
