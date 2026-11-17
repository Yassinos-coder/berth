import { expect, test } from '@playwright/test';
import { mockApi } from './fixtures/mockApi';

const ENV = [
  { key: 'PORT', value: '3000', isSecret: false },
  { key: 'API_TOKEN', value: 'tok_live_123', isSecret: true },
];

test.describe('variables as text', () => {
  test('edits as .env, keeps secrets masked, and saves the result', async ({ page }) => {
    const calls = await mockApi(page, { env: ENV });
    await page.goto('/services/svc-web?tab=env');
    await page.getByRole('button', { name: 'Edit as text' }).click();

    const editor = page.getByRole('textbox', { name: 'Variables as text' });
    await expect(editor).toHaveValue('PORT=3000\nAPI_TOKEN=********');
    await expect(page.getByTestId('env-raw-editor')).not.toContainText('tok_live_123');

    await editor.fill('PORT=8080\nAPI_TOKEN=********\nNODE_ENV=production');
    await page.getByRole('button', { name: 'Apply changes' }).click();

    await expect(page.getByLabel('Value for PORT')).toHaveValue('8080');
    await expect(page.getByLabel('Key for NODE_ENV')).toBeVisible();

    await page.getByRole('button', { name: 'Save Variables' }).click();
    await expect
      .poll(() => calls.find((call) => call.method === 'PUT' && call.path === '/services/svc-web/env')?.body)
      .toEqual({
        env: [
          { key: 'PORT', value: '8080', isSecret: false },
          { key: 'API_TOKEN', value: 'tok_live_123', isSecret: true },
          { key: 'NODE_ENV', value: 'production', isSecret: false },
        ],
      });
  });

  test('switches to JSON and back without losing anything', async ({ page }) => {
    await mockApi(page, { env: ENV });
    await page.goto('/services/svc-web?tab=env');
    await page.getByRole('button', { name: 'Edit as text' }).click();

    await page.getByRole('radio', { name: 'JSON' }).click();
    const editor = page.getByRole('textbox', { name: 'Variables as text' });
    expect(JSON.parse(await editor.inputValue())).toEqual({ PORT: '3000', API_TOKEN: '********' });

    await page.getByRole('radio', { name: '.env' }).click();
    await expect(editor).toHaveValue('PORT=3000\nAPI_TOKEN=********');
  });

  test('shows secret values only when asked', async ({ page }) => {
    await mockApi(page, { env: ENV });
    await page.goto('/services/svc-web?tab=env');
    await page.getByRole('button', { name: 'Edit as text' }).click();

    await page.getByRole('switch', { name: 'Show secret values' }).click();
    await expect(page.getByRole('textbox', { name: 'Variables as text' })).toHaveValue(/API_TOKEN=tok_live_123/);
  });

  test('points at the bad line and stays in the editor', async ({ page }) => {
    await mockApi(page, { env: ENV });
    await page.goto('/services/svc-web?tab=env');
    await page.getByRole('button', { name: 'Edit as text' }).click();

    await page.getByRole('textbox', { name: 'Variables as text' }).fill('PORT=1\nthis is not valid');
    await page.getByRole('button', { name: 'Apply changes' }).click();

    await expect(page.getByRole('alert')).toContainText('Line 2');
    await expect(page.getByTestId('env-raw-editor')).toBeVisible();
  });

  test('cancel leaves the list untouched', async ({ page }) => {
    await mockApi(page, { env: ENV });
    await page.goto('/services/svc-web?tab=env');
    await page.getByRole('button', { name: 'Edit as text' }).click();
    await page.getByRole('textbox', { name: 'Variables as text' }).fill('X=1');
    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(page.getByLabel('Value for PORT')).toHaveValue('3000');
  });
});
