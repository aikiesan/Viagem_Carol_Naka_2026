// Verificações estáticas de integridade e segurança para produção (GitHub Pages).
// Não precisam de navegador — rodam em qualquer ambiente com Node.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');

const html = read('index.html');
const sw = read('sw.js');
const manifest = JSON.parse(read('manifest.json'));

test('manifest.json é válido e usa caminhos relativos (seguro em subpath)', () => {
  assert.ok(manifest.name && manifest.short_name, 'precisa de name/short_name');
  assert.equal(typeof manifest.start_url, 'string');
  assert.ok(!manifest.start_url.startsWith('/'), 'start_url deve ser relativo');
  assert.ok(!manifest.scope || !manifest.scope.startsWith('/') || manifest.scope === './', 'scope deve ser relativo');
  assert.ok(manifest.theme_color, 'precisa de theme_color');
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 2, 'precisa de ícones');
  // O id, se presente, não pode ser absoluto divergente do escopo
  if (manifest.id) assert.ok(!manifest.id.startsWith('/'), 'id absoluto quebra a identidade do PWA em subpath');
});

test('todos os ícones do manifest existem no disco', () => {
  for (const icon of manifest.icons) {
    assert.ok(existsSync(join(ROOT, icon.src)), `ícone ausente: ${icon.src}`);
  }
});

test('todas as imagens referenciadas no index.html existem', () => {
  const srcs = [...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(srcs.length > 0, 'esperava encontrar imagens');
  for (const src of srcs) {
    if (/^(https?:)?\/\//.test(src) || src.startsWith('data:')) continue;
    assert.ok(existsSync(join(ROOT, src)), `imagem referenciada ausente: ${src}`);
  }
});

test('o service worker pré-cacheia TODAS as imagens/ícones do repositório (offline real)', () => {
  const media = readdirSync(ROOT).filter((f) => /\.(jpe?g|png)$/i.test(f));
  assert.ok(media.length >= 14, 'esperava as imagens da viagem');
  for (const file of media) {
    assert.ok(sw.includes(`./${file}`), `não está no pré-cache do sw.js: ${file}`);
  }
});

test('todo asset listado no pré-cache do sw.js existe no disco', () => {
  const listed = [...sw.matchAll(/'\.\/([^']+)'/g)].map((m) => m[1]).filter(Boolean);
  assert.ok(listed.length > 0);
  for (const rel of listed) {
    if (rel === '') continue;
    assert.ok(existsSync(join(ROOT, rel)), `asset do pré-cache ausente: ${rel}`);
  }
});

test('sw.js define um CACHE_NAME versionado', () => {
  assert.match(sw, /const\s+CACHE_NAME\s*=\s*'[^']+'/);
});

test('index.html não usa caminhos absolutos que quebram no GitHub Pages', () => {
  // src="/..." ou href="/..." (excluindo // de protocolo) quebram em usuario.github.io/repo/
  const bad = [...html.matchAll(/(?:src|href)="(\/[^/][^"]*)"/g)].map((m) => m[1]);
  assert.deepEqual(bad, [], `caminhos absolutos encontrados: ${bad.join(', ')}`);
});

test('o registro do service worker é relativo (./sw.js)', () => {
  assert.match(html, /serviceWorker\.register\(\s*['"]\.\/sw\.js['"]/);
  assert.match(html, /<link[^>]+rel="manifest"[^>]+href="manifest\.json"/);
});

test('o JavaScript embutido no index.html é sintaticamente válido', () => {
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(m, 'bloco <script> não encontrado');
  // new vm.Script lança em erro de sintaxe, sem executar o código
  assert.doesNotThrow(() => new vm.Script(m[1]), 'erro de sintaxe no JS embutido');
});

test('sw.js e tools/serve.mjs são sintaticamente válidos', () => {
  assert.doesNotThrow(() => new vm.Script(sw));
});
