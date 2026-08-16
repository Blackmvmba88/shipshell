import { expect, test } from '@playwright/test';

test('smoke: professional home surface loads cleanly', async ({ page }) => {
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

  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Navegador' })).toBeVisible();
  await expect(page.getByText('ShipSeal protegido')).toBeVisible();
  await expect(page.getByLabel('Cambiar universo')).toHaveValue('professional-graphite');
  await expect(page.getByText(/AI conectada · Professional Graphite/)).toBeVisible();

  await page.screenshot({ path: 'test-results/home.png', fullPage: true });
});
