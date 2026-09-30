#!/usr/bin/env node
/**
 * Copia todos os arquivos do Supabase Storage de um projeto para outro
 * (usado na migração us-east-1 -> sa-east-1).
 *
 * Uso (PowerShell):
 *   $env:OLD_URL="https://<ref-antigo>.supabase.co"; $env:OLD_KEY="<service_role antigo>"
 *   $env:NEW_URL="https://<ref-novo>.supabase.co";   $env:NEW_KEY="<service_role novo>"
 *   node scripts/migrate-storage.mjs            # copia
 *   node scripts/migrate-storage.mjs --dry-run  # só lista
 *
 * As chaves ficam em Project Settings -> API Keys (service_role / secret).
 * Não commite as chaves. Idempotente: pode rodar de novo (sobrescreve com upsert).
 */

const { OLD_URL, OLD_KEY, NEW_URL, NEW_KEY } = process.env;
const DRY = process.argv.includes('--dry-run');

if (!OLD_URL || !OLD_KEY || !NEW_URL || !NEW_KEY) {
  console.error('Defina OLD_URL, OLD_KEY, NEW_URL e NEW_KEY.');
  process.exit(1);
}

function headers(key, extra = {}) {
  const h = { apikey: key, ...extra };
  // Chaves legadas (JWT) também vão no Authorization; sb_secret_ só no apikey.
  if (key.startsWith('eyJ')) h.Authorization = `Bearer ${key}`;
  return h;
}

async function api(base, key, path, opts = {}) {
  const res = await fetch(`${base.replace(/\/$/, '')}/storage/v1${path}`, {
    ...opts,
    headers: headers(key, opts.headers)
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${opts.method || 'GET'} ${path} -> ${res.status} ${body}`);
  }
  return res;
}

const encodePath = (p) => p.split('/').map(encodeURIComponent).join('/');

async function listAll(bucket, prefix = '') {
  const out = [];
  let offset = 0;
  for (;;) {
    const res = await api(OLD_URL, OLD_KEY, `/object/list/${bucket}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } })
    });
    const items = await res.json();
    for (const it of items) {
      const full = prefix ? `${prefix}/${it.name}` : it.name;
      if (it.id === null) out.push(...(await listAll(bucket, full))); // pasta
      else out.push({ path: full, mimetype: it.metadata?.mimetype });
    }
    if (items.length < 1000) break;
    offset += 1000;
  }
  return out;
}

async function ensureBucket(b) {
  const res = await fetch(`${NEW_URL.replace(/\/$/, '')}/storage/v1/bucket/${b.id}`, { headers: headers(NEW_KEY) });
  if (res.ok) return;
  if (DRY) { console.log(`  [dry] criaria bucket ${b.id}`); return; }
  await api(NEW_URL, NEW_KEY, '/bucket', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: b.id,
      name: b.name,
      public: b.public,
      file_size_limit: b.file_size_limit,
      allowed_mime_types: b.allowed_mime_types
    })
  });
  console.log(`  bucket ${b.id} criado`);
}

const buckets = await (await api(OLD_URL, OLD_KEY, '/bucket')).json();
let copied = 0;
let failed = 0;

for (const b of buckets) {
  console.log(`\n== ${b.id} (public=${b.public})`);
  await ensureBucket(b);
  const files = await listAll(b.id);
  for (const f of files) {
    if (DRY) { console.log(`  [dry] ${f.path}`); continue; }
    try {
      const dl = await api(OLD_URL, OLD_KEY, `/object/${b.id}/${encodePath(f.path)}`);
      const buf = Buffer.from(await dl.arrayBuffer());
      const type = f.mimetype || dl.headers.get('content-type') || 'application/octet-stream';
      await api(NEW_URL, NEW_KEY, `/object/${b.id}/${encodePath(f.path)}`, {
        method: 'POST',
        headers: { 'Content-Type': type, 'x-upsert': 'true' },
        body: buf
      });
      copied++;
      console.log(`  ok ${f.path} (${buf.length} bytes)`);
    } catch (err) {
      failed++;
      console.error(`  ERRO ${f.path}: ${err.message}`);
    }
  }
}

console.log(`\nFim: ${copied} copiados, ${failed} com erro.`);
process.exit(failed ? 1 : 0);
