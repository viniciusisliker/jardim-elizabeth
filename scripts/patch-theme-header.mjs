import fs from 'node:fs';

const snippet = fs.readFileSync('components/theme-switch-snippet.html', 'utf8');
const inner = snippet
  .replace(/^<label[\s\S]*?<input[^>]*>\s*/m, '')
  .replace(/<\/label>[\s\S]*/m, '')
  .trim();

function buildLabel(extraClass, forId) {
  return [
    `<label class="theme-switch ${extraClass}" for="${forId}" aria-label="Alternar tema claro ou escuro">`,
    `  <input type="checkbox" class="theme-switch__checkbox" id="${forId}" data-je-theme-toggle>`,
    `  ${inner}`,
    '</label>'
  ].join('\n');
}

let header = fs.readFileSync('components/header.html', 'utf8');

const desktop = buildLabel('je-site-theme-switch', 'je-theme-toggle');
const mobile = [
  '<div class="je-mobile-theme-row je-site-menu-mobile-only">',
  '  <span class="je-mobile-theme-label">Aparência</span>',
  '  ' + buildLabel('je-mobile-theme-switch', 'je-theme-toggle-mobile').replace(/\n/g, '\n  '),
  '</div>'
].join('\n');

if (!header.includes('je-theme-toggle')) {
  header = header.replace(
    '        <button type="button" id="je-install-app-btn"',
    `        ${desktop.replace(/\n/g, '\n        ')}\n\n        <button type="button" id="je-install-app-btn"`
  );
  header = header.replace(
    '    <div id="mobile-menu-promo-slot" class="je-mobile-menu-promo-slot"></div>',
    `    <div id="mobile-menu-promo-slot" class="je-mobile-menu-promo-slot"></div>\n\n    ${mobile.replace(/\n/g, '\n    ')}`
  );
  fs.writeFileSync('components/header.html', header);
  console.log('header patched');
} else {
  console.log('header already has theme toggle');
}
