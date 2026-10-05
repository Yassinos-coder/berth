import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mockApi } from './fixtures/mockApi';

async function openPalette(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('main')).toBeVisible();
  await page.keyboard.press('Control+k');
  const input = page.getByRole('combobox', { name: 'Search commands' });
  await expect(input).toBeVisible();
  return input;
}

test.describe('auth gate', () => {
  test('sends signed-out visitors to the login page', async ({ page }) => {
    await mockApi(page, { authenticated: false });
    await page.goto('/services');
    await expect(page).toHaveURL(/\/login/);
  });

  test('shows the app shell when signed in', async ({ page }) => {
    await mockApi(page);
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Services', exact: true }).first()).toBeVisible();
  });
});

test.describe('command palette', () => {
  test('opens with Ctrl+K and jumps to a service', async ({ page }) => {
    await mockApi(page);
    const input = await openPalette(page);
    await expect(input).toBeFocused();
    await input.fill('store');
    await expect(page.getByRole('option', { name: /storefront/ })).toBeVisible();
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/\/services\/svc-web$/);
  });

  test('filters out non-matching entries and reports no results', async ({ page }) => {
    await mockApi(page);
    const input = await openPalette(page);
    await input.fill('zzzzqq');
    await expect(page.getByText('No results.')).toBeVisible();
  });

  test('closes with Escape', async ({ page }) => {
    await mockApi(page);
    await openPalette(page);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('combobox', { name: 'Search commands' })).toBeHidden();
  });
});
