#!/usr/bin/env node
/**
 * Valida JPGs de mapas em img/territorios (t01.jpg … t19.jpg).
 * Uso: node scripts/validate-territory-maps.mjs
 * Exit 0 se todos existem; 1 se faltar algum.
 */
import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'img', 'territorios');
const checklistPath = join(root, 'scripts', 'territory-map-checklist.json');
const maxBytes = 1.5 * 1024 * 1024;

const checklist = JSON.parse(readFileSync(checklistPath, 'utf8'));
const expected = checklist.territories.map((t) => t.file);

if (!existsSync(dir)) {
  console.error('Pasta ausente:', dir);
  process.exit(1);
}

const present = new Set(readdirSync(dir));
let missing = 0;
let oversized = 0;

console.log('Mapas em img/territorios/\n');
for (const file of expected) {
  const path = join(dir, file);
  if (!existsSync(path)) {
    console.log(`  ✗ ${file}  AUSENTE`);
    missing += 1;
    continue;
  }
  const { size } = statSync(path);
  const mb = (size / (1024 * 1024)).toFixed(2);
  const warn = size > maxBytes ? '  (acima de 1,5 MB — comprimir se possível)' : '';
  if (size > maxBytes) oversized += 1;
  console.log(`  ✓ ${file}  ${mb} MB${warn}`);
}

const extras = [...present].filter((f) => /\.(jpe?g|png)$/i.test(f) && !expected.includes(f));
if (extras.length) {
  console.log('\nArquivos extras (não usados pelo padrão tXX.jpg):');
  extras.forEach((f) => console.log(`  · ${f}`));
}

console.log(`\nResumo: ${expected.length - missing}/${expected.length} presentes${oversized ? `, ${oversized} grandes` : ''}.`);
if (missing) {
  console.error('Faltam mapas. Salve como img/territorios/tXX.jpg e rode de novo.');
  process.exit(1);
}
console.log('Pronto para commit/deploy quando os JPGs forem atualizados.');
process.exit(0);
