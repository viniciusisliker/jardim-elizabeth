const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

function lines(file) {
  return fs.readFileSync(path.join(root, file), 'utf8').split(/\r?\n/);
}

function writePartial(name, parts) {
  const out = path.join(root, 'hub/sections', name);
  fs.writeFileSync(out, parts.flat().join('\n'), 'utf8');
  console.log(name, fs.statSync(out).size);
}

const terr = lines('admin/territorios.html');
writePartial('territorios.html', [
  ['    <div class="flex justify-end mb-4">',
   '      <a href="territorios.html" target="_blank" rel="noopener" class="text-xs font-semibold text-secondary border border-outline-variant px-3 py-2 rounded-lg hover:bg-white shrink-0">Ver mapas públicos ↗</a>',
   '    </div>'],
  terr.slice(422, 553),
  terr.slice(554, 567)
]);

const an = lines('admin/anuncios.html');
writePartial('anuncios.html', [an.slice(145, 275), an.slice(277, 358)]);

const di = lines('admin/discursos-publicos.html');
writePartial('discursos.html', [di.slice(122, 181), di.slice(183, 190)]);

const cfg = lines('admin/configuracoes.html');
writePartial('configuracoes.html', [cfg.slice(105, 166)]);
