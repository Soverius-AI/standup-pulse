import { expect, Page, test } from '@playwright/test';

const pulse = {
  team: { id: 'team-1', name: 'Product Team', timeZone: 'Europe/Vienna' },
  date: '2026-08-06',
  generatedAt: '2026-08-06T09:12:00+02:00',
  totals: {
    roster: 4,
    posted: 2,
    missing: 1,
    blocked: 1,
    participationPct: 75,
  },
  deltas: { posted: 1, missing: -1, blocked: 1, participationPoints: -5 },
  standups: [
    {
      memberId: 'alex',
      displayName: 'Alex Kim',
      status: 'posted',
      preview: 'Completed auth refactor and added tests.',
    },
    { memberId: 'maya', displayName: 'Maya Chen', status: 'missing' },
    {
      memberId: 'sara',
      displayName: 'Sara Lind',
      status: 'blocked',
      preview: 'Blocked on API credentials from the security team.',
      blockerId: 'blocker-1',
    },
    {
      memberId: 'nora',
      displayName: 'Nora Weiss',
      status: 'posted',
      preview: 'Reviewed designs and left feedback.',
    },
  ],
  trend: [
    { date: '2026-07-31', participationPct: 67 },
    { date: '2026-08-01', participationPct: 72 },
    { date: '2026-08-02', participationPct: 78 },
    { date: '2026-08-03', participationPct: 75 },
    { date: '2026-08-04', participationPct: 81 },
    { date: '2026-08-05', participationPct: 100 },
    { date: '2026-08-06', participationPct: 75 },
  ],
  blockers: [
    {
      id: 'blocker-1',
      title: 'Waiting for API credentials',
      owner: { memberId: 'sara', displayName: 'Sara Lind' },
      ageDays: 2,
    },
  ],
};

const status = {
  service: { state: 'online' },
  database: { state: 'online' },
  model: { state: 'online', modelId: 'Gemma 4 26B' },
  agent: { state: 'online' },
  channel: { state: 'online', name: 'Standup Pulse' },
  scheduler: { state: 'online', timeZone: 'Europe/Vienna' },
  capabilities: { proactiveNudges: false },
};

const roster = {
  team: pulse.team,
  members: [
    {
      id: 'alex',
      displayName: 'Alex Kim',
      email: 'alex@example.com',
      slackLinked: true,
      active: true,
    },
    {
      id: 'maya',
      displayName: 'Maya Chen',
      slackLinked: false,
      active: true,
    },
    {
      id: 'sara',
      displayName: 'Sara Lind',
      slackLinked: true,
      active: true,
    },
    {
      id: 'nora',
      displayName: 'Nora Weiss',
      slackLinked: true,
      active: false,
    },
  ],
};

async function mockDashboardApi(page: Page): Promise<void> {
  await page.route('**/api/team-pulse?**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(pulse),
    }),
  );
  await page.route('**/api/status', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(status),
    }),
  );
  await page.route('**/api/roster', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(roster),
    }),
  );
  await page.route('**/api/copilotkit**', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'runtime unavailable in UI fixture' }),
    }),
  );
}

test('puts missing updates and blockers ahead of analytics', async ({
  page,
}) => {
  await mockDashboardApi(page);
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'Daily pulse' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /haven’t posted/ }),
  ).toBeVisible();
  await expect(page.getByText('Maya Chen')).toBeVisible();
  await expect(page.getByText('Waiting for API credentials')).toBeVisible();
  await expect(
    page.getByRole('img', { name: /Seven-day participation/ }),
  ).toBeVisible();

  const attentionTop = await page
    .locator('.attention-banner')
    .evaluate((element) => element.getBoundingClientRect().top);
  const kpiTop = await page
    .locator('.pulse-kpis')
    .evaluate((element) => element.getBoundingClientRect().top);
  expect(attentionTop).toBeLessThan(kpiTop);

  const nudge = page.getByRole('button', { name: 'Nudge missing' });
  await expect(nudge).toBeDisabled();
  await expect(nudge).toHaveAttribute('title', /unavailable/);
  await expect(
    page.getByRole('complementary', { name: 'Standup Copilot' }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Team' }).click();
  await expect(
    page.getByRole('heading', { name: 'Team members' }),
  ).toBeVisible();
  await expect(page.getByText('alex@example.com')).toBeVisible();
  await page.getByRole('button', { name: 'Edit' }).first().click();
  await expect(page.getByRole('dialog', { name: 'Edit member' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();

  await page.getByRole('button', { name: 'History' }).click();
  await expect(
    page.getByRole('heading', { name: 'Standup history' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Settings', exact: true }),
  ).toBeVisible();
});

test('keeps the dashboard usable on a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockDashboardApi(page);
  await page.goto('/');

  await page
    .locator('.pulse-chat__header')
    .getByRole('button', { name: 'Close Standup Copilot' })
    .click();
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(
    page.getByRole('navigation', { name: 'Primary navigation' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Today' })).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test('keeps Copilot mounted and contains actions while the side panel is open', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1352, height: 900 });
  await mockDashboardApi(page);
  await page.goto('/');

  const chat = page.locator('[data-chat-mounted]');
  await expect(chat).toHaveCount(1);
  await expect(chat).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);

  const actionBounds = await page
    .getByRole('button', { name: 'Review blockers' })
    .boundingBox();
  expect(actionBounds).not.toBeNull();
  expect(
    (actionBounds?.x ?? 0) + (actionBounds?.width ?? 0),
  ).toBeLessThanOrEqual(1352);

  await page
    .locator('.pulse-chat__header')
    .getByRole('button', { name: 'Close Standup Copilot' })
    .click();
  await expect(chat).toBeHidden();
  await page.getByRole('button', { name: 'Copilot' }).click();
  await expect(chat).toBeVisible();
  await expect(chat).toHaveCount(1);
});
