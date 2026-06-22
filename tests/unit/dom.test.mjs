// Testes de comportamento do app rodando o JS real dentro do jsdom.
// Simula deploy em subpath (como GitHub Pages) e sem rede (fetch rejeitado),
// exercitando os caminhos offline do app.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');

// Carrega o app em uma janela jsdom fresca (localStorage isolado por teste).
async function loadApp() {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (e) => errors.push(e));

  const dom = new JSDOM(html, {
    url: 'https://example.github.io/Viagem_Carol_Naka_2026/index.html', // subpath
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      // Sem rede: força os fallbacks offline de câmbio e clima
      window.fetch = () => Promise.reject(new Error('offline-test'));
      window.scrollTo = () => {};
      window.Element.prototype.scrollIntoView = () => {};
      Object.defineProperty(window.navigator, 'clipboard', {
        configurable: true,
        value: { writeText: () => Promise.resolve() }
      });
    }
  });

  const { window } = dom;
  await new Promise((resolve) => {
    if (window.document.readyState === 'complete') resolve();
    else window.addEventListener('load', resolve, { once: true });
  });
  // deixa os .catch/.finally dos fetch rejeitados resolverem
  await new Promise((r) => setTimeout(r, 0));

  return { window, document: window.document, errors };
}

test('carrega sem erros de JavaScript', async () => {
  const { errors } = await loadApp();
  assert.deepEqual(errors.map(String), [], 'não deveria haver erros no console');
});

test('a agenda renderiza todos os 18 dias da viagem', async () => {
  const { document } = await loadApp();
  const cards = document.querySelectorAll('#timeline-container .timeline-day-card');
  assert.equal(cards.length, 18);
});

test('o checklist renderiza 6 categorias e 37 itens', async () => {
  const { document } = await loadApp();
  assert.equal(document.querySelectorAll('.checklist-category').length, 6);
  assert.equal(document.querySelectorAll('.checklist-item').length, 37);
  assert.match(document.getElementById('checklist-progress-count').textContent, /0\/37/);
});

test('navegação entre views funciona e persiste no localStorage', async () => {
  const { window, document } = await loadApp();
  window.switchView('agenda');
  assert.ok(document.getElementById('view-agenda').classList.contains('active'));
  assert.ok(!document.getElementById('view-inicio').classList.contains('active'));
  assert.equal(window.localStorage.getItem('guia_last_view'), 'agenda');
});

test('conversor de moedas é bidirecional (taxas offline padrão)', async () => {
  const { window, document } = await loadApp();
  // window.fxRates é definido no fallback offline: eur_ron 5.25, eur_brl 5.88
  document.getElementById('input-eur').value = '10';
  window.convertFrom('eur');
  assert.equal(document.getElementById('input-ron').value, '52.50');
  assert.equal(document.getElementById('input-brl').value, '58.80');

  document.getElementById('input-brl').value = '58.80';
  window.convertFrom('brl');
  assert.equal(document.getElementById('input-eur').value, '10.00');
  assert.equal(document.getElementById('input-ron').value, '52.50');
});

test('rastreador de gastos: adiciona, soma em BRL e persiste', async () => {
  const { window, document } = await loadApp();
  document.getElementById('exp-note').value = 'Jantar';
  document.getElementById('exp-amount').value = '20';
  document.getElementById('exp-currency').value = 'EUR';
  window.addExpense();

  assert.equal(document.querySelectorAll('#expense-list .expense-row').length, 1);
  // 20 EUR * 5.88 = R$ 117,60
  assert.match(document.getElementById('exp-total-brl').textContent, /117,60/);

  const stored = JSON.parse(window.localStorage.getItem('guia_expenses'));
  assert.equal(stored.length, 1);
  window.deleteExpense(stored[0].id);
  assert.equal(document.querySelectorAll('#expense-list .expense-row').length, 0);
});

test('anotações por dia são salvas no localStorage', async () => {
  const { window, document } = await loadApp();
  document.getElementById('note-input-22jun').value = 'Embarque tranquilo!';
  window.saveDayNote('22jun');
  const notes = JSON.parse(window.localStorage.getItem('guia_notes'));
  assert.equal(notes['22jun'], 'Embarque tranquilo!');
});

test('progresso da viagem: pré-viagem, durante e concluída', async () => {
  const { window, document } = await loadApp();
  window.updateTripProgress(new Date(2026, 5, 4)); // 04 jun (antes)
  assert.match(document.getElementById('trip-day-label').textContent, /Faltam/);

  window.updateTripProgress(new Date(2026, 6, 1)); // 01 jul (durante)
  assert.match(document.getElementById('trip-day-label').textContent, /Dia \d+ de 19/);

  window.updateTripProgress(new Date(2026, 7, 1)); // 01 ago (depois)
  assert.match(document.getElementById('trip-day-label').textContent, /conclu/);
  assert.equal(document.getElementById('trip-progress-fill').style.width, '100%');
});

test('tema dinâmico por cidade ajusta o data-city', async () => {
  const { window, document } = await loadApp();
  window.applyCityTheme('Berlim, Alemanha 🏛️');
  assert.equal(document.body.dataset.city, 'berlim');
  window.applyCityTheme('Timișoara, Romênia 🇷🇴');
  assert.equal(document.body.dataset.city, 'timisoara');
  window.applyCityTheme('Pré-Viagem ✈️');
  assert.equal(document.body.dataset.city, undefined);
});

test('escapeHtml protege conteúdo do usuário (XSS)', async () => {
  const { window } = await loadApp();
  assert.equal(window.escapeHtml('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
});

test('frases: troca de idioma e filtro por categoria', async () => {
  const { window, document } = await loadApp();
  window.switchLang('de');
  assert.equal(document.querySelectorAll('#frases-list .frase-card').length, 99);
  window.switchLang('ro');
  assert.equal(document.querySelectorAll('#frases-list .frase-card').length, 99);
  window.filterFrases('emerg', null);
  const filtered = document.querySelectorAll('#frases-list .frase-card').length;
  assert.ok(filtered >= 1 && filtered < 99, `filtro inesperado: ${filtered}`);
  // novas categorias: Carol solo e Lucas social
  window.filterFrases('solo', null);
  assert.ok(document.querySelectorAll('#frases-list .frase-card').length >= 1, 'categoria solo vazia');
  window.filterFrases('social', null);
  assert.ok(document.querySelectorAll('#frases-list .frase-card').length >= 1, 'categoria social vazia');
});

test('progresso do checklist e da agenda atualiza ao interagir', async () => {
  const { window, document } = await loadApp();
  window.toggleChecklistItem('documentos_0');
  assert.match(document.getElementById('checklist-progress-count').textContent, /1\/37/);

  window.cycleAgendaStatus('22jun_task_0'); // pendente -> feito
  assert.notEqual(document.getElementById('agenda-progress-count').textContent, '0%');
  assert.match(document.getElementById('daycount-22jun').textContent, /1\/3/);
});

test('estado persistido é restaurado em um novo carregamento', async () => {
  const first = await loadApp();
  first.window.toggleChecklistItem('roupas_1');
  const saved = first.window.localStorage.getItem('guia_checklist');
  assert.ok(saved);

  // novo "carregamento" reaproveitando o mesmo storage
  const dom = new JSDOM(html, {
    url: 'https://example.github.io/Viagem_Carol_Naka_2026/index.html',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.fetch = () => Promise.reject(new Error('offline-test'));
      window.scrollTo = () => {};
      window.Element.prototype.scrollIntoView = () => {};
      window.localStorage.setItem('guia_checklist', saved);
    }
  });
  await new Promise((resolve) => dom.window.addEventListener('load', resolve, { once: true }));
  await new Promise((r) => setTimeout(r, 0));

  const row = dom.window.document.getElementById('chk-roupas_1');
  assert.ok(row.classList.contains('checked'), 'item deveria continuar marcado');
});
