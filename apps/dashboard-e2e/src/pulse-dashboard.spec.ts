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

type CopilotFixtureMode = 'text' | 'a2ui';

async function mockDashboardApi(
  page: Page,
  copilotMode: CopilotFixtureMode = 'text',
): Promise<void> {
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
  await page.route('**/api/copilotkit**', (route) => {
    const url = new URL(route.request().url());

    if (url.pathname.endsWith('/info')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          version: '1.66.2',
          agents: {
            standupDashboard: {
              name: 'standupDashboard',
              description: 'E2E Standup Copilot',
              className: 'StandupDashboardAgent',
              capabilities: {},
            },
          },
          audioFileTranscriptionEnabled: false,
          mode: 'sse',
          threadEndpoints: {
            list: false,
            inspect: false,
            mutations: false,
            realtimeMetadata: false,
          },
          suggestions: true,
          a2uiEnabled: true,
          openGenerativeUIEnabled: true,
        }),
      });
    }

    if (url.pathname.endsWith('/agent/standupDashboard/run')) {
      const request = route.request().postDataJSON() as {
        threadId?: string;
        runId?: string;
      };
      const threadId = request.threadId ?? 'e2e-thread';
      const runId = request.runId ?? 'e2e-run';
      const events =
        copilotMode === 'a2ui'
          ? [
              { type: 'RUN_STARTED', threadId, runId },
              {
                type: 'ACTIVITY_SNAPSHOT',
                messageId: 'a2ui-surface-e2e-a2ui-tool',
                activityType: 'a2ui-surface',
                content: {
                  a2ui_operations: [
                    {
                      version: 'v0.9',
                      createSurface: {
                        surfaceId: 'e2e-team-pulse',
                        catalogId:
                          'https://a2ui.org/specification/v0_9/basic_catalog.json',
                        theme: {},
                      },
                    },
                    {
                      version: 'v0.9',
                      updateComponents: {
                        surfaceId: 'e2e-team-pulse',
                        components: [
                          {
                            id: 'root',
                            component: 'Column',
                            children: ['heading', 'participation'],
                          },
                          {
                            id: 'heading',
                            component: 'Text',
                            text: 'Team pulse',
                            variant: 'h3',
                          },
                          {
                            id: 'participation',
                            component: 'Text',
                            text: '75% participation',
                          },
                        ],
                      },
                    },
                  ],
                },
                replace: true,
              },
              { type: 'RUN_FINISHED', threadId, runId },
            ]
          : [
              { type: 'RUN_STARTED', threadId, runId },
              {
                type: 'TEXT_MESSAGE_START',
                messageId: 'e2e-assistant-message',
                role: 'assistant',
              },
              {
                type: 'TEXT_MESSAGE_CONTENT',
                messageId: 'e2e-assistant-message',
                delta: 'Fixture response from Standup Copilot.',
              },
              {
                type: 'TEXT_MESSAGE_END',
                messageId: 'e2e-assistant-message',
              },
              { type: 'RUN_FINISHED', threadId, runId },
            ];
      return route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        headers: { 'cache-control': 'no-cache' },
        body: events
          .map((event) => `data: ${JSON.stringify(event)}\n\n`)
          .join(''),
      });
    }

    return route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Unknown CopilotKit fixture route' }),
    });
  });
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
  await expect(page.locator('[data-chat-mounted]')).toHaveCount(1);
  await expect(page.locator('[data-chat-mounted]')).toBeHidden();

  await page.getByRole('link', { name: 'Team' }).click();
  await expect(
    page.getByRole('heading', { name: 'Team members' }),
  ).toBeVisible();
  await expect(page.getByText('alex@example.com')).toBeVisible();
  await page.getByRole('button', { name: 'Edit' }).first().click();
  await expect(page.getByRole('dialog', { name: 'Edit member' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();

  await page.getByRole('link', { name: 'History' }).click();
  await expect(
    page.getByRole('heading', { name: 'Standup history' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Settings', exact: true }),
  ).toBeVisible();
});

test('keeps the dashboard usable on a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockDashboardApi(page);
  await page.goto('/');

  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(
    page.getByRole('navigation', { name: 'Primary navigation' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Today' })).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test('keeps Copilot mounted and preserves composer spacing after a message', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1352, height: 900 });
  await mockDashboardApi(page);
  await page.goto('/');

  const chat = page.locator('[data-chat-mounted]');
  await expect(chat).toHaveCount(1);
  await page.getByRole('button', { name: 'Copilot' }).click();
  await expect(chat).toBeVisible();

  const chatLayout = await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>('.pulse-chat');
    const input = document.querySelector<HTMLElement>('.copilotKitInput');
    if (!panel || !input) return null;
    const panelBounds = panel.getBoundingClientRect();
    const inputBounds = input.getBoundingClientRect();
    return {
      panelLeft: panelBounds.left,
      panelRight: panelBounds.right,
      inputLeft: inputBounds.left,
      inputRight: inputBounds.right,
      panelOverflows: panel.scrollWidth > panel.clientWidth,
    };
  });
  expect(chatLayout).not.toBeNull();
  expect(chatLayout?.inputLeft).toBeGreaterThanOrEqual(
    chatLayout?.panelLeft ?? 0,
  );
  expect(chatLayout?.inputRight).toBeLessThanOrEqual(
    chatLayout?.panelRight ?? 0,
  );
  expect(chatLayout?.panelOverflows).toBe(false);

  const composer = page.locator('textarea[copilotChatTextarea]');
  await expect(composer).toBeEnabled();
  await composer.fill('Give me a short team pulse.');
  await composer.press('Enter');
  await expect(
    page.getByText('Fixture response from Standup Copilot.'),
  ).toBeVisible();
  await page.waitForFunction(() =>
    document
      .querySelector<HTMLElement>('.pulse-chat__body')
      ?.style.getPropertyValue('--pulse-chat-composer-reserve')
      .endsWith('px'),
  );

  const postMessageLayout = await page.evaluate(() => {
    const body = document.querySelector<HTMLElement>('.pulse-chat__body');
    const input = document.querySelector<HTMLElement>('.copilotKitInput');
    const scrollContent = document.querySelector<HTMLElement>(
      "copilot-chat-view-scroll-view [style*='padding-bottom']",
    );
    const assistantMessage = Array.from(
      document.querySelectorAll<HTMLElement>('copilot-chat-assistant-message'),
    ).at(-1);
    if (!body || !input || !scrollContent || !assistantMessage) return null;

    const bodyBounds = body.getBoundingClientRect();
    const inputBounds = input.getBoundingClientRect();
    const messageBounds = assistantMessage.getBoundingClientRect();
    return {
      actualReserve: Number.parseFloat(
        body.style.getPropertyValue('--pulse-chat-composer-reserve'),
      ),
      expectedReserve: Math.ceil(bodyBounds.bottom - inputBounds.top + 16),
      appliedPadding: Number.parseFloat(
        getComputedStyle(scrollContent).paddingBottom,
      ),
      messageBottom: messageBounds.bottom,
      inputTop: inputBounds.top,
    };
  });
  expect(postMessageLayout).not.toBeNull();
  expect(postMessageLayout?.actualReserve).toBe(
    postMessageLayout?.expectedReserve,
  );
  expect(postMessageLayout?.appliedPadding).toBe(
    postMessageLayout?.actualReserve,
  );
  expect(postMessageLayout?.messageBottom).toBeLessThanOrEqual(
    postMessageLayout?.inputTop ?? 0,
  );

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

test('renders one model-generated A2UI activity surface', async ({
  page,
}) => {
  await mockDashboardApi(page, 'a2ui');
  await page.goto('/');

  await page.getByRole('button', { name: 'Copilot' }).click();
  const composer = page.locator('textarea[copilotChatTextarea]');
  await composer.fill("Show today's team pulse visually.");
  await composer.press('Enter');

  await expect(
    page.locator('[data-testid="a2ui-activity-surface-scroll"]'),
  ).toHaveCount(1);
  await expect(page.locator('[data-testid="a2ui-tool-surface"]')).toHaveCount(
    0,
  );
  await expect(page.getByText('75% participation')).toBeVisible();
  await expect(page.locator('copilot-open-generative-ui-renderer')).toHaveCount(
    0,
  );
});
