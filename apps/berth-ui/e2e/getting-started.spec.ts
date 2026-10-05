import { expect, test, type Page } from '@playwright/test';
import { mockApi } from './fixtures/mockApi';

const TITLE = 'Get started with Berth';

async function settled(page: Page) {
  await expect(page.getByText('3 running').or(page.getByText('2 running'))).toBeVisible();
  await page.waitForLoadState('networkidle');
}

test.describe('getting started checklist', () => {
  test('shows progress from real account state', async ({ page }) => {
    await mockApi(page);
    await page.goto('/');
    await expect(page.getByText(TITLE)).toBeVisible();
    await expect(page.getByText('2 of 5 done')).toBeVisible();
    await expect(page.getByRole('link', { name: /Connect GitHub/ })).toHaveAttribute('href', '/settings');
  });

  test('disappears once every step is complete', async ({ page }) => {
    await mockApi(page, {
      githubConnected: true,
      proxyHosts: [{ id: 'p1' }],
      channels: [{ id: 'c1' }],
    });
    await page.goto('/');
    await settled(page);
    await expect(page.getByText(TITLE)).toHaveCount(0);
  });

  test('can be dismissed and stays dismissed', async ({ page }) => {
    await mockApi(page);
    await page.goto('/');
    await expect(page.getByText(TITLE)).toBeVisible();
    await page.getByRole('button', { name: 'Dismiss getting started' }).click();
    await expect(page.getByText(TITLE)).toHaveCount(0);

    await page.reload();
    await settled(page);
    await expect(page.getByText(TITLE)).toHaveCount(0);
  });
});
