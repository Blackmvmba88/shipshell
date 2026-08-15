import { test, expect } from '@playwright/test';

test('smoke: load home and take screenshot', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'test-results/home.png', fullPage: true });
  // Basic sanity: ensure body exists
  await expect(page.locator('body')).toBeVisible();
});
