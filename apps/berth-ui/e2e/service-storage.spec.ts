import { expect, test } from '@playwright/test';
import { GIT_SERVICE, mockApi } from './fixtures/mockApi';

const limited = { ...GIT_SERVICE, volumePath: '/data', diskGb: 5, diskLimited: true };
const legacy = { ...GIT_SERVICE, volumePath: '/data', diskGb: 5, diskLimited: false };

test.describe('service storage size', () => {
  test('a stateless service explains it needs none', async ({ page }) => {
    await mockApi(page);
    await page.goto('/services/svc-web?tab=settings');

    await expect(page.getByText(/no persistent storage, which is right for a stateless backend/)).toBeVisible();
  });

  test('changes the size without deleting the service', async ({ page }) => {
    const calls = await mockApi(page, { services: [limited] });
    await page.goto('/services/svc-web?tab=settings');

    await expect(page.getByTestId('current-limit')).toHaveText('5 GB');
    const apply = page.getByRole('button', { name: 'Apply size' });
    await expect(apply).toBeDisabled();

    await page.getByRole('button', { name: '10 GB' }).click();
    await expect(page.getByText(/Your data is kept/)).toBeVisible();
    await apply.click();

    await expect
      .poll(() => calls.find((call) => call.method === 'PATCH' && call.path === '/services/svc-web')?.body)
      .toEqual({ diskGb: 10 });
  });

  test('refuses to grow past the free budget and says by how much', async ({ page }) => {
    await mockApi(page, { services: [limited] });
    await page.goto('/services/svc-web?tab=settings');

    await page.getByLabel('New size (GB)').fill('25');
    await expect(page.getByRole('alert').filter({ hasText: 'needs 20 GB more' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Apply size' })).toBeDisabled();
  });

  test('warns when shrinking and always allows it', async ({ page }) => {
    await mockApi(page, { services: [{ ...limited, diskGb: 10 }] });
    await page.goto('/services/svc-web?tab=settings');

    await page.getByRole('button', { name: '1 GB' }).click();
    await expect(page.getByText(/Shrinking works only if your data fits/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Apply size' })).toBeEnabled();
  });

  test('an older volume is flagged as unlimited and can opt in', async ({ page }) => {
    const calls = await mockApi(page, { services: [legacy] });
    await page.goto('/services/svc-web?tab=settings');

    await expect(page.getByTestId('unlimited-notice')).toContainText('no size limit');
    await page.getByRole('button', { name: 'Enforce limit' }).click();
    await expect(page.getByRole('dialog')).toContainText('original volume is left untouched as a backup');
    expect(calls.some((call) => call.method === 'PATCH')).toBe(false);

    await page.getByRole('dialog').getByRole('button', { name: 'Enforce limit' }).click();
    await expect
      .poll(() => calls.find((call) => call.method === 'PATCH' && call.path === '/services/svc-web')?.body)
      .toEqual({ diskGb: 5, enforceDiskLimit: true });
  });
});

test.describe('storage usage', () => {
  const usage = (usedMb: number) => ({ usedMb, totalMb: 5000, at: new Date().toISOString() });

  test('shows how much of the limit is used', async ({ page }) => {
    await mockApi(page, { services: [{ ...limited, volumeUsage: usage(1250) }] });
    await page.goto('/services/svc-web?tab=settings');
    const bar = page.getByTestId('volume-usage');
    await expect(bar).toContainText('1.2 GB used of 4.9 GB');
    await expect(bar).toContainText('25%');
    await expect(bar.getByRole('status')).toHaveCount(0);
  });

  test('warns when nearly full', async ({ page }) => {
    await mockApi(page, { services: [{ ...limited, volumeUsage: usage(4700) }] });
    await page.goto('/services/svc-web?tab=settings');
    await expect(page.getByTestId('volume-usage')).toContainText('94%');
    await expect(page.getByText(/Almost full/)).toBeVisible();
  });

  test('shows nothing until the agent has reported', async ({ page }) => {
    await mockApi(page, { services: [limited] });
    await page.goto('/services/svc-web?tab=settings');
    await expect(page.getByTestId('current-limit')).toBeVisible();
    await expect(page.getByTestId('volume-usage')).toHaveCount(0);
  });
});
