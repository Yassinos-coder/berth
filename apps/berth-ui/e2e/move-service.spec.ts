import { expect, test } from '@playwright/test';
import { GIT_SERVICE, SERVER, mockApi } from './fixtures/mockApi';

const second = { ...SERVER, id: 'srv2', name: 'edge-2', cpuCores: 2, memoryMb: 4096 };
const offline = { ...SERVER, id: 'srv3', name: 'edge-3', status: 'offline' };

test.describe('move to another server', () => {
  test('only offers other servers that are online', async ({ page }) => {
    await mockApi(page, { extraServers: [second, offline] });
    await page.goto('/services/svc-web?tab=settings');
    await page.getByLabel('New server').click();
    await expect(page.getByRole('option', { name: /edge-2/ })).toBeVisible();
    await expect(page.getByRole('option', { name: /edge-3/ })).toHaveCount(0);
  });

  test('explains what happens and then moves the service', async ({ page }) => {
    const calls = await mockApi(page, { extraServers: [second] });
    await page.goto('/services/svc-web?tab=settings');
    const trigger = page.getByRole('button', { name: 'Move service' });
    await expect(trigger).toBeDisabled();

    await page.getByLabel('New server').click();
    await page.getByRole('option', { name: /edge-2/ }).click();
    await trigger.click();
    await expect(page.getByText(/short interruption/)).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Move service' }).click();

    await expect
      .poll(() => calls.find((call) => call.method === 'POST' && call.path === '/services/svc-web/move')?.body)
      .toEqual({ serverId: 'srv2', confirmDataLoss: false });
  });

  test('a service with files needs the data warning accepted first', async ({ page }) => {
    const calls = await mockApi(page, {
      extraServers: [second],
      services: [{ ...GIT_SERVICE, volumePath: '/data', diskGb: 5, diskLimited: true }],
    });
    await page.goto('/services/svc-web?tab=settings');
    await page.getByLabel('New server').click();
    await page.getByRole('option', { name: /edge-2/ }).click();

    const trigger = page.getByRole('button', { name: 'Move service' });
    await expect(trigger).toBeDisabled();
    await page.getByLabel(/stored files will not move/).check();
    await expect(trigger).toBeEnabled();
    await trigger.click();
    await page.getByRole('dialog').getByRole('button', { name: 'Move service' }).click();

    await expect
      .poll(() => calls.find((call) => call.path === '/services/svc-web/move')?.body)
      .toEqual({ serverId: 'srv2', confirmDataLoss: true });
  });

  test('says so when there is no other server', async ({ page }) => {
    await mockApi(page);
    await page.goto('/services/svc-web?tab=settings');
    await expect(page.getByText(/no other online server/)).toBeVisible();
  });
});
