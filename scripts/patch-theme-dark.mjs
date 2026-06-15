import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const version = '2026061518';
const darkLink = `  <link href="css/je-theme-dark.css?v=${version}" rel="stylesheet"/>\n`;

const colorMap = [
  ['"primary": "#0f3462"', '"primary": "var(--je-primary)"'],
  ['"background": "#fbf9f8"', '"background": "var(--je-background)"'],
  ['"surface": "#fbf9f8"', '"surface": "var(--je-surface)"'],
  ['"surface-bright": "#fbf9f8"', '"surface-bright": "var(--je-surface-bright)"'],
  ['"on-background": "#1b1c1c"', '"on-background": "var(--je-on-background)"'],
  ['"on-surface": "#1b1c1c"', '"on-surface": "var(--je-on-surface)"'],
  ['"on-surface-variant": "#43474f"', '"on-surface-variant": "var(--je-on-surface-variant)"'],
  ['"outline": "#747780"', '"outline": "var(--je-outline)"'],
  ['"outline-variant": "#c3c6d0"', '"outline-variant": "var(--je-outline-variant)"'],
  ['"surface-container": "#f0eded"', '"surface-container": "var(--je-surface-container)"'],
  ['"surface-container-low": "#f5f3f3"', '"surface-container-low": "var(--je-surface-container-low)"'],
  ['"surface-container-high": "#eae8e7"', '"surface-container-high": "var(--je-surface-container-high)"'],
  ['"surface-container-highest": "#e4e2e2"', '"surface-container-highest": "var(--je-surface-container-highest)"'],
  ['"surface-container-lowest": "#ffffff"', '"surface-container-lowest": "var(--je-surface-container-lowest)"'],
  ['"primary-container": "#2b4b7a"', '"primary-container": "var(--je-primary-container)"'],
  ['"on-primary-container": "#9dbcf2"', '"on-primary-container": "var(--je-on-primary-container)"'],
  ['"on-primary": "#ffffff"', '"on-primary": "var(--je-on-primary)"'],
  ['"secondary": "#3b5e97"', '"secondary": "var(--je-secondary)"'],
  ['"secondary-fixed": "#d6e3ff"', '"secondary-fixed": "var(--je-secondary-fixed)"'],
  ['"secondary-fixed-dim": "#aac7ff"', '"secondary-fixed-dim": "var(--je-secondary-fixed-dim)"'],
  ['"secondary-container": "#9cbffe"', '"secondary-container": "var(--je-secondary-container)"'],
  ['"primary-fixed": "#d6e3ff"', '"primary-fixed": "var(--je-primary-fixed)"'],
  ['"on-primary-fixed": "#001b3d"', '"on-primary-fixed": "var(--je-on-primary-fixed)"'],
  ['"inverse-on-surface": "#f2f0f0"', '"inverse-on-surface": "var(--je-inverse-on-surface)"'],
  ['"error": "#ba1a1a"', '"error": "var(--je-error)"']
];

const files = fs.readdirSync(root).filter((f) => f.endsWith('.html'));

for (const file of files) {
  const full = path.join(root, file);
  let html = fs.readFileSync(full, 'utf8');
  let changed = false;

  if (html.includes('tailwind.config') && html.includes('"background"')) {
    for (const [from, to] of colorMap) {
      if (html.includes(from)) {
        html = html.split(from).join(to);
        changed = true;
      }
    }
  }

  if (!html.includes('je-theme-dark.css')) {
    html = html.replace('</head>', `${darkLink}</head>`);
    changed = true;
  }

  if (html.includes('je-theme.css?v=2026061517')) {
    html = html.replace(/je-theme\.css\?v=2026061517/g, `je-theme.css?v=${version}`);
    changed = true;
  }

  if (html.includes('je-theme.js') && !html.includes(`je-theme.js?v=${version}`)) {
    html = html.replace(/js\/je-theme\.js(\?v=\d+)?/g, `js/je-theme.js?v=${version}`);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(full, html);
    console.log('patched', file);
  }
}

console.log('done');
