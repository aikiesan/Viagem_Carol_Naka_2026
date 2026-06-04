import { test, expect } from '@playwright/test';

test('a página carrega com o shell do app', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e));

  await page.goto('/');
  await expect(page).toHaveTitle(/Carol/);
  await expect(page.locator('.header-bar h1')).toContainText('Carol');
  // O hero deve ter sido populado pela detecção de destino (não fica "Carregando...")
  await expect(page.locator('#dest-name')).not.toHaveText('Carregando...');

  expect(pageErrors, 'nenhuma exceção JS não tratada').toEqual([]);
});

test('o service worker registra e fica ativo', async ({ page }) => {
  await page.goto('/');
  const ok = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false;
    const reg = await navigator.serviceWorker.ready;
    return !!reg.active;
  });
  expect(ok).toBe(true);
});

test('o manifest está acessível e é válido', async ({ page }) => {
  const resp = await page.request.get('/manifest.json');
  expect(resp.ok()).toBeTruthy();
  const manifest = await resp.json();
  expect(manifest.name).toBeTruthy();
  expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
  // theme-color presente no documento
  await page.goto('/');
  await expect(page.locator('meta[name="theme-color"]')).toHaveCount(1);
});

test('a navegação inferior troca de views', async ({ page }) => {
  await page.goto('/');
  await page.locator('.bottom-nav').getByText('Agenda').click();
  await expect(page.locator('#view-agenda')).toBeVisible();
  await expect(page.locator('#timeline-container .timeline-day-card').first()).toBeVisible();

  await page.locator('.bottom-nav').getByText('Frases').click();
  await expect(page.locator('#view-frases')).toBeVisible();
  await expect(page.locator('#frases-list .frase-card').first()).toBeVisible();
});

test('atalho deep-link (?view=agenda) abre a agenda', async ({ page }) => {
  await page.goto('/index.html?view=agenda');
  await expect(page.locator('#view-agenda')).toBeVisible();
});

test('atalho deep-link (?action=help) abre o modal de emergência', async ({ page }) => {
  await page.goto('/index.html?action=help');
  await expect(page.locator('#modal-overlay')).toHaveClass(/open/);
  await expect(page.locator('#modal-body-content')).toContainText('112');
});

test('funciona OFFLINE depois de cacheado (produção GitHub Pages)', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  // garante que a página passe a ser controlada pelo SW
  await page.reload();
  await page.evaluate(() => navigator.serviceWorker.ready);

  await context.setOffline(true);
  await page.reload();

  // O shell do app continua disponível offline
  await expect(page.locator('.header-bar h1')).toContainText('Carol');
  await expect(page.locator('.bottom-nav')).toBeVisible();

  // Uma imagem de destino pré-cacheada carrega mesmo offline
  await page.locator('.bottom-nav').getByText('Destinos').click();
  await page.locator('#acc-leipzig .accordion-header').click();
  const imgOk = await page
    .locator('#acc-leipzig img')
    .first()
    .evaluate((img) => img.complete && img.naturalWidth > 0);
  expect(imgOk).toBe(true);

  await context.setOffline(false);
});
