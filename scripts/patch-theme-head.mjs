import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const headBlock = `  <script src="js/je-theme-boot.js"></script>
  <link href="css/je-theme.css?v=2026061517" rel="stylesheet"/>
  <script src="js/je-theme.js" defer></script>
`;

const files = [
  'index.html',
  'hub.html',
  'agenda.html',
  'agendamentos.html',
  'territorios.html',
  'quadrodeanuncios.html',
  'donativos.html',
  'carrinhos.html',
  'displays.html'
];

for (const file of files) {
  const full = path.join(root, file);
  let html = fs.readFileSync(full, 'utf8');
  if (html.includes('je-theme-boot.js')) {
    console.log('skip', file);
    continue;
  }
  html = html.replace(
    /<meta[^>]*name="viewport"[^>]*>\s*/i,
    (m) => `${m}${headBlock}\n`
  );
  html = html.replace(/<html class="light" /i, '<html ');
  fs.writeFileSync(full, html);
  console.log('patched', file);
}
