#!/usr/bin/env bun
import { readFileSync, writeFileSync } from 'node:fs';

const input = readFileSync('c:/Users/lucas/ts7006.txt', 'utf8');
const lines = input.trim().split('\n');

interface Fix {
  file: string;
  line: number;
  col: number;
  param: string;
}

const fixes: Fix[] = [];
for (const line of lines) {
  const m = line.match(/^(.+?)\((\d+),(\d+)\).*Parameter '(\w+)'/);
  if (m) {
    fixes.push({ file: m[1], line: Number(m[2]), col: Number(m[3]), param: m[4] });
  }
}

console.log(`Parsed ${fixes.length} fixes`);

// Group by file
const byFile = new Map<string, Fix[]>();
for (const fix of fixes) {
  if (!byFile.has(fix.file)) byFile.set(fix.file, []);
  byFile.get(fix.file)!.push(fix);
}

for (const [file, fileFixes] of byFile) {
  const content = readFileSync(file, 'utf8');
  const fileLines = content.split('\n');

  // Process in reverse order so line numbers don't shift
  const sorted = fileFixes.sort((a, b) => b.line - a.line || b.col - a.col);

  for (const fix of sorted) {
    const lineIdx = fix.line - 1;
    const line = fileLines[lineIdx];
    if (!line) continue;

    // Find the parameter at roughly the right column
    const searchStart = Math.max(0, fix.col - 2);
    const paramIdx = line.indexOf(fix.param, searchStart);
    if (paramIdx === -1) continue;

    const paramEnd = paramIdx + fix.param.length;
    const afterParam = line[paramEnd];

    // Skip if already typed
    if (afterParam === ':') continue;

    fileLines[lineIdx] = line.slice(0, paramEnd) + ': any' + line.slice(paramEnd);
  }

  writeFileSync(file, fileLines.join('\n'));
  console.log(`  Fixed ${fileFixes.length} params in ${file}`);
}
