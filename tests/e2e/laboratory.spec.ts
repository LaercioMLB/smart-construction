import { test as base, expect } from '@playwright/test';
const test = base.extend<{ localNetwork: void }>({
  localNetwork: [
    async ({ page, baseURL }, use) => {
      const outside: string[] = [];
      const runtimeErrors: string[] = [];
      page.on('pageerror', (error) => runtimeErrors.push(error.message));
      await page.route('**/*', async (route) => {
        const url = new URL(route.request().url());
        if (url.origin !== new URL(baseURL ?? 'http://127.0.0.1:3011').origin) {
          outside.push(url.origin);
          await route.abort();
        } else await route.continue();
      });
      await use();
      expect(outside, 'Requisições do navegador permanecem no laboratório').toEqual([]);
      expect(runtimeErrors, 'Sem erros de execução/hidratação').toEqual([]);
    },
    { auto: true },
  ],
});
test('home identifica a empresa fictícia e mantém o catálogo navegável', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Smart Construction/);
  await expect(page.getByText('Ambiente fictício de laboratório.', { exact: false })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Sua Obra Perfeita');
  const search = page.getByRole('combobox', { name: 'Buscar serviço' });
  await search.fill('meu cano estourou');
  await expect(page.getByRole('option').first()).toContainText('Encanador');
  await search.press('ArrowDown');
  await search.press('Enter');
  await expect(page).toHaveURL(/servicos\/encanador$/);
});
test('orçamento usa somente o canal simulado local', async ({ page }) => {
  await page.goto('/servicos/eletricista');
  await page.getByRole('link', { name: 'Solicitar Orçamento', exact: true }).first().click();
  await expect(page).toHaveURL(/\/contato$/);
  await expect(page.getByRole('heading', { name: 'Atendimento simulado' })).toBeVisible();
  await expect(
    page.locator('a[href^="https://wa.me"], a[href^="tel:"], a[href^="mailto:"]'),
  ).toHaveCount(0);
});
test('catálogo preserva filtros e paginação', async ({ page }) => {
  await page.goto('/catalogo');
  await page.getByRole('checkbox', { name: /Portas/ }).check();
  await expect(page).toHaveURL(/category=portas/);
  await page.getByRole('combobox', { name: 'Ordenar por', exact: true }).selectOption('price-asc');
  await expect(page).toHaveURL(/sortBy=price-asc/);
  await page.reload();
  await expect(page.getByRole('checkbox', { name: /Portas/ })).toBeChecked();
});
test('textos versionados são do exercício e não contêm os contatos reais', async ({ page }) => {
  for (const route of ['/termos-de-uso', '/politica-de-privacidade']) {
    await page.goto(route);
    await expect(page.locator('main')).toContainText('dados sintéticos');
    await expect(page.locator('main')).toContainText('lab-2026-11-11');
    await expect(page.locator('body')).not.toContainText(
      /35\.536\.662|99997-6544|CLOI JEAN|soscomercial/,
    );
  }
});
test('menu móvel e acesso administrativo estão disponíveis', async ({ page }) => {
  await page.goto('/');
  await page.locator('header').getByRole('link', { name: 'Painel de admin' }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByLabel('Login', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Abrir menu' }).click();
  await page
    .getByRole('navigation', { name: 'Navegação móvel' })
    .getByRole('link', { name: 'Catálogo' })
    .click();
  await expect(page).toHaveURL(/\/catalogo$/);
  await page.locator('header').getByRole('link', { name: 'Painel de admin' }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByLabel('Login', { exact: true })).toBeVisible();
});

test('páginas principais cabem em telas pequenas e grandes', async ({ page }, testInfo) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['/', '/servicos', '/catalogo', '/sobre', '/contato']) {
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(overflow, route + ' em ' + width + 'px').toBe(false);
    }
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Sua Obra Perfeita');
    await expect(
      page.getByRole('img', { name: 'Ilustração de planejamento de uma obra' }),
    ).toHaveJSProperty('complete', true);
    for (const image of await page.locator('main img, footer img').all()) {
      await image.scrollIntoViewIfNeeded();
      await expect(image).toHaveJSProperty('complete', true);
      await expect
        .poll(() =>
          image.evaluate((node) => (node instanceof HTMLImageElement ? node.naturalWidth : 0)),
        )
        .toBeGreaterThan(0);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath('home-' + width + '.png'), fullPage: true });
  }
});
