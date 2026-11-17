import { expect, test } from '@playwright/test';
import { mockApi } from './fixtures/mockApi';

const HOST_DISK = { totalGb: 100, freeGb: 63, suggestedBudgetGb: 31 };

async function setup(page: Parameters<typeof mockApi>[0]) {
  const calls = await mockApi(page, {
    authenticated: false,
    setup: { needsSetup: true, hostDisk: HOST_DISK },
  });
  await page.goto('/setup');
  return calls;
}

async function fillAccount(page: Parameters<typeof mockApi>[0]) {
  await page.getByLabel('Full name').fill('Ada Admin');
  await page.getByLabel('Email').fill('ada@example.com');
  await page.getByLabel('Password').fill('correct-horse-battery');
  await page.getByRole('button', { name: 'Continue' }).click();
}

test.describe('first-run setup', () => {
  test('checks the account before moving on', async ({ page }) => {
    await setup(page);
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByText('Enter your name')).toBeVisible();
    await expect(page.getByText('Enter a valid email')).toBeVisible();
    await expect(page.getByLabel('Storage for Berth (GB)')).toHaveCount(0);
  });

  test('shows the real disk and suggests a budget', async ({ page }) => {
    await setup(page);
    await fillAccount(page);

    await expect(page.getByText('This server has 100 GB of disk, 63 GB free.')).toBeVisible();
    await expect(page.getByLabel('Storage for Berth (GB)')).toHaveValue('31');
    const breakdown = page.getByTestId('storage-breakdown');
    await expect(breakdown).toContainText('26 GB');
    await expect(breakdown).toContainText('5 GB');
  });

  test('updates the split as the budget changes', async ({ page }) => {
    await setup(page);
    await fillAccount(page);

    await page.getByLabel('Storage for Berth (GB)').fill('25');
    await expect(page.getByTestId('storage-breakdown')).toContainText('21 GB');
    await expect(page.getByTestId('storage-breakdown')).toContainText('4 GB');
  });

  test('sends the chosen budget with the account', async ({ page }) => {
    const calls = await setup(page);
    await fillAccount(page);
    await page.getByLabel('Storage for Berth (GB)').fill('25');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect
      .poll(() => calls.find((call) => call.method === 'POST' && call.path === '/auth/register')?.body)
      .toEqual({ name: 'Ada Admin', email: 'ada@example.com', password: 'correct-horse-battery', storageBudgetGb: 25 });
  });

  test('refuses a budget larger than the free space', async ({ page }) => {
    const calls = await setup(page);
    await fillAccount(page);
    await page.getByLabel('Storage for Berth (GB)').fill('90');
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByText(/63 GB free|between 5 and 63 GB/).first()).toBeVisible();
    expect(calls.some((call) => call.path === '/auth/register')).toBe(false);
  });

  test('going back keeps what you typed', async ({ page }) => {
    await setup(page);
    await fillAccount(page);
    await page.getByRole('button', { name: 'Back' }).click();

    await expect(page.getByLabel('Full name')).toHaveValue('Ada Admin');
    await expect(page.getByLabel('Email')).toHaveValue('ada@example.com');
  });

  test('can skip the AI advisor and still create the account', async ({ page }) => {
    const calls = await setup(page);
    await fillAccount(page);
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Enable the AI advisor')).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Enable the AI advisor' })).not.toBeChecked();
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect.poll(() => calls.some((call) => call.path === '/auth/register')).toBe(true);
    expect(calls.some((call) => call.path === '/advisor/settings')).toBe(false);
  });

  test('configures the advisor with a locked URL for a known provider', async ({ page }) => {
    const calls = await setup(page);
    await fillAccount(page);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('switch', { name: 'Enable the AI advisor' }).click();

    await expect(page.getByLabel('API URL')).toHaveValue('https://api.anthropic.com');
    await expect(page.getByLabel('API URL')).toBeDisabled();
    await expect(page.getByLabel('Monthly spending cap (USD)')).toHaveValue('5');

    const create = page.getByRole('button', { name: 'Create account' });
    await expect(page.getByText('Paste an API key.')).toBeVisible();
    await expect(create).toBeDisabled();

    await page.getByLabel('API key').fill('sk-ant-test-1234567890');
    await create.click();

    await expect
      .poll(() => calls.find((call) => call.method === 'PUT' && call.path === '/advisor/settings')?.body)
      .toMatchObject({ enabled: true, provider: 'anthropic', model: 'claude-sonnet-5-5', apiKey: 'sk-ant-test-1234567890', monthlyCapUsd: 5 });
  });

  test('lets a custom provider set its own URL', async ({ page }) => {
    await setup(page);
    await fillAccount(page);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('switch', { name: 'Enable the AI advisor' }).click();
    await page.getByLabel('Provider').click();
    await page.getByRole('option', { name: 'Custom (OpenAI-compatible)' }).click();

    await expect(page.getByLabel('API URL')).toBeEnabled();
    await page.getByLabel('API URL').fill('https://llm.example.com/v1');
    await expect(page.getByLabel('API URL')).toHaveValue('https://llm.example.com/v1');
  });
});
