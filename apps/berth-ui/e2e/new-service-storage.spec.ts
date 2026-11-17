import { expect, test, type Page } from '@playwright/test';
import { mockApi } from './fixtures/mockApi';

async function chooseServer(page: Page) {
  await page.getByRole('combobox').filter({ hasText: /Select a server/ }).click();
  await page.getByRole('option', { name: /edge-1/ }).click();
}

test.describe('new service: storage and resources', () => {
  test('a stateless deployment does not ask for storage unless you turn it on', async ({ page }) => {
    await mockApi(page);
    await page.goto('/services/new');
    await page.getByRole('button', { name: /Docker Image/ }).click();

    const toggle = page.getByRole('switch', { name: 'This service needs persistent storage' });
    await expect(toggle).not.toBeChecked();
    await expect(page.getByText(/does not need this/)).toBeVisible();
    await expect(page.getByLabel('Size (GB)')).toHaveCount(0);

    await toggle.click();
    await expect(page.getByLabel('Mount path inside the container')).toBeVisible();
    await expect(page.getByLabel('Size (GB)')).toHaveValue('5');
  });

  test('a database always has storage, sized for the engine', async ({ page }) => {
    await mockApi(page);
    await page.goto('/services/new?template=tpl_postgres');

    await expect(page.getByText('Database storage')).toBeVisible();
    await expect(page.getByLabel('Size (GB)')).toHaveValue('5');
    await expect(page.getByRole('button', { name: '25 GB' })).toBeVisible();
    await expect(page.getByRole('switch', { name: 'This service needs persistent storage' })).toHaveCount(0);
  });

  test('a cache starts smaller than a database', async ({ page }) => {
    await mockApi(page);
    await page.goto('/services/new?template=tpl_redis');

    await expect(page.getByLabel('Size (GB)')).toHaveValue('1');
  });

  test('presets set the resources and Custom reveals the selects', async ({ page }) => {
    await mockApi(page);
    await page.goto('/services/new?template=tpl_postgres');

    await page.getByRole('radio', { name: /Large/ }).click();
    await expect(page.getByRole('radio', { name: /Large/ })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByLabel('CPU limit')).toHaveCount(0);

    await page.getByRole('radio', { name: /Custom/ }).click();
    await expect(page.getByLabel('CPU limit')).toBeVisible();
    await expect(page.getByLabel('Memory limit')).toBeVisible();
  });

  test('shows how much room the chosen server has left', async ({ page }) => {
    await mockApi(page);
    await page.goto('/services/new?template=tpl_postgres');
    await expect(page.getByTestId('capacity-panel')).toHaveCount(0);

    await chooseServer(page);
    const panel = page.getByTestId('capacity-panel');
    await expect(panel).toContainText('Room on edge-1');
    await expect(panel).toContainText('11 of 21 GB');
  });

  test('sends the chosen size when creating a database', async ({ page }) => {
    const calls = await mockApi(page);
    await page.goto('/services/new?template=tpl_postgres');
    await page.getByLabel('Service name').fill('orders-db');
    await chooseServer(page);
    await page.getByRole('button', { name: '10 GB' }).click();
    await page.getByRole('button', { name: 'Create service' }).click();

    await expect
      .poll(() => calls.find((call) => call.method === 'POST' && call.path === '/services')?.body)
      .toMatchObject({ name: 'orders-db', template: 'postgres', diskGb: 10, serverId: 'srv1' });
  });

  test('refuses a size the server cannot hold and explains why', async ({ page }) => {
    const calls = await mockApi(page);
    await page.goto('/services/new?template=tpl_postgres');
    await page.getByLabel('Service name').fill('big-db');
    await chooseServer(page);
    await page.getByLabel('Size (GB)').fill('50');

    await expect(page.getByTestId('capacity-panel').getByRole('alert')).toContainText('Only 15 GB');
    await page.getByRole('button', { name: 'Create service' }).click();
    await page.waitForTimeout(400);
    expect(calls.some((call) => call.method === 'POST' && call.path === '/services')).toBe(false);
  });
});
