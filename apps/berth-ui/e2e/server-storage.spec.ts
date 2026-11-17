import { expect, test } from '@playwright/test';
import { mockApi } from './fixtures/mockApi';

test.describe('server storage budget', () => {
  test('shows how the budget is split', async ({ page }) => {
    await mockApi(page);
    await page.goto('/servers/srv1');

    const bar = page.getByTestId('storage-bar');
    await expect(bar).toContainText('Services 6 GB');
    await expect(bar).toContainText('Images, cache & logs 4 GB');
    await expect(bar).toContainText('Free for services 15 GB');
    await expect(page.getByLabel('Budget (GB)')).toHaveValue('25');
  });

  test('saves a new budget', async ({ page }) => {
    const calls = await mockApi(page);
    await page.goto('/servers/srv1');

    const save = page.getByRole('button', { name: 'Save budget' });
    await expect(save).toBeDisabled();
    await page.getByLabel('Budget (GB)').fill('40');
    await save.click();

    await expect
      .poll(() => calls.find((call) => call.method === 'PATCH' && call.path === '/servers/srv1/storage')?.body)
      .toEqual({ storageBudgetGb: 40 });
  });

  test('refuses a budget smaller than what services already use', async ({ page }) => {
    await mockApi(page);
    await page.goto('/servers/srv1');
    await page.getByLabel('Budget (GB)').fill('6');

    await expect(page.getByText(/At least 8 GB/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save budget' })).toBeDisabled();
  });

  test('explains a server with no budget yet', async ({ page }) => {
    await mockApi(page, {
      server: { storage: { budgetGb: null, reservedGb: 0, allocatedGb: 0, allocatableGb: null, freeGb: null } },
    });
    await page.goto('/servers/srv1');

    await expect(page.getByTestId('no-budget')).toBeVisible();
    await expect(page.getByLabel('Budget (GB)')).toHaveValue('25');
    await expect(page.getByRole('button', { name: 'Set budget' })).toBeEnabled();
  });
});
