import { expect, test } from '@playwright/test';
import { GIT_SERVICE, mockApi } from './fixtures/mockApi';

test.describe('release command', () => {
  test('saves a migration command', async ({ page }) => {
    const calls = await mockApi(page);
    await page.goto('/services/svc-web?tab=settings');
    const save = page.getByRole('button', { name: 'Save release command' });
    await expect(save).toBeDisabled();

    await page.getByLabel('Command').fill('npx prisma migrate deploy');
    await save.click();

    await expect
      .poll(() => calls.find((call) => call.method === 'PATCH' && call.path === '/services/svc-web')?.body)
      .toEqual({ releaseCommand: 'npx prisma migrate deploy' });
  });

  test('shows the saved command and can clear it', async ({ page }) => {
    const calls = await mockApi(page, { services: [{ ...GIT_SERVICE, releaseCommand: 'npm run migrate' }] });
    await page.goto('/services/svc-web?tab=settings');
    await expect(page.getByLabel('Command')).toHaveValue('npm run migrate');

    await page.getByLabel('Command').fill('');
    await page.getByRole('button', { name: 'Save release command' }).click();
    await expect
      .poll(() => calls.find((call) => call.method === 'PATCH')?.body)
      .toEqual({ releaseCommand: '' });
  });
});
