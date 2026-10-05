import { expect, test, type Page } from '@playwright/test';
import { mockApi } from './fixtures/mockApi';

async function openAlerts(page: Page) {
  await page.goto('/settings');
  await page.getByRole('tab', { name: 'Resources' }).click();
  await expect(page.getByText('Send resource alerts')).toBeVisible();
}

test.describe('resource alert settings', () => {
  test('shows the saved thresholds', async ({ page }) => {
    await mockApi(page, { alertSettings: { enabled: true, cpuPct: 80, memPct: 85, diskPct: 95, minutes: 10 } });
    await openAlerts(page);
    await expect(page.getByLabel('CPU')).toHaveValue('80');
    await expect(page.getByLabel('Memory')).toHaveValue('85');
    await expect(page.getByLabel('Server disk')).toHaveValue('95');
    await expect(page.getByLabel('Sustained for')).toHaveValue('10');
  });

  test('saves only after a valid change', async ({ page }) => {
    const calls = await mockApi(page);
    await openAlerts(page);
    const save = page.getByRole('button', { name: 'Save alert settings' });
    await expect(save).toBeDisabled();

    await page.getByLabel('CPU').fill('75');
    await page.getByLabel('Sustained for').fill('3');
    await expect(save).toBeEnabled();
    await save.click();

    await expect
      .poll(() => calls.find((call) => call.method === 'PATCH' && call.path === '/alert-settings')?.body)
      .toEqual({ enabled: true, cpuPct: 75, memPct: 90, diskPct: 90, minutes: 3 });
  });

  test('blocks out-of-range values with a message', async ({ page }) => {
    const calls = await mockApi(page);
    await openAlerts(page);
    await page.getByLabel('Server disk').fill('100');
    await expect(page.getByText('Disk must be a whole number from 50 to 99.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save alert settings' })).toBeDisabled();
    expect(calls.some((call) => call.method === 'PATCH' && call.path === '/alert-settings')).toBe(false);
  });

  test('reset discards edits', async ({ page }) => {
    await mockApi(page);
    await openAlerts(page);
    await page.getByLabel('Memory').fill('60');
    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(page.getByLabel('Memory')).toHaveValue('90');
  });

  test('disables the fields when alerts are switched off', async ({ page }) => {
    await mockApi(page);
    await openAlerts(page);
    await page.locator('#alerts-enabled').click();
    await expect(page.getByLabel('CPU')).toBeDisabled();
  });

  test('is read-only for members who cannot manage resources', async ({ page }) => {
    await mockApi(page, { role: 'viewer' });
    await openAlerts(page);
    await expect(page.getByLabel('CPU')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Save alert settings' })).toHaveCount(0);
    await expect(page.getByText('Only organization owners and admins can change these settings.')).toBeVisible();
  });
});

test.describe('per-service alert mute', () => {
  test('saves the mute switch', async ({ page }) => {
    const calls = await mockApi(page);
    await page.goto('/services/svc-web?tab=settings');
    await page.getByRole('switch', { name: 'Mute alerts for this service' }).click();
    await expect
      .poll(() => calls.find((call) => call.method === 'PATCH' && call.path === '/services/svc-web')?.body)
      .toEqual({ alertsMuted: true });
  });
});
