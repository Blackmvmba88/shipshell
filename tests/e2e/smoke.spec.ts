import { expect, test, type Page } from '@playwright/test';

async function mockShellApi(page: Page) {
  await page.route('**/api/health', async (route) => {
    await route.fulfill({
      json: {
        ok: true,
        system: 'ShipShell',
        model: 'test-model',
        aiConfigured: true,
        workspace: '/workspace/shipshell',
      },
    });
  });

  await page.route('**/api/logbook', async (route) => {
    await route.fulfill({ json: { entries: [] } });
  });

  await page.route('**/api/terminal/state**', async (route) => {
    await route.fulfill({ json: { cwd: '/workspace/shipshell' } });
  });
}

test('smoke: professional home surface loads cleanly', async ({ page }) => {
  await mockShellApi(page);
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Navegador' })).toBeVisible();
  await expect(page.getByText('ShipSeal protegido')).toBeVisible();
  await expect(page.getByLabel('Cambiar universo')).toHaveValue('professional-graphite');
  await expect(page.getByText(/AI conectada · Professional Graphite/)).toBeVisible();

  const terminalContext = page.getByRole('button', { name: 'Activar contexto IA del terminal' });
  await expect(terminalContext).toHaveAttribute('aria-pressed', 'false');
  await terminalContext.click();
  await expect(page.getByRole('button', { name: 'Desactivar contexto IA del terminal' })).toHaveAttribute('aria-pressed', 'true');

  await page.screenshot({ path: 'test-results/home.png', fullPage: true });
});

test('terminal history removes recognized secrets from older persisted sessions', async ({ page }) => {
  await mockShellApi(page);
  await page.goto('/');

  await page.evaluate(() => {
    localStorage.setItem('shipshell.terminal.history', JSON.stringify([
      'git status',
      'echo OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz123456',
    ]));
  });

  await page.reload();

  const persistedHistory = await page.evaluate(() => JSON.parse(localStorage.getItem('shipshell.terminal.history') ?? '[]'));
  expect(persistedHistory).toEqual(['git status']);
});
