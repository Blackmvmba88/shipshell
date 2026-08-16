import { expect, test, type Page } from '@playwright/test';

async function mockBaseApi(page: Page) {
  await page.route('**/api/health', async (route) => {
    await route.fulfill({
      json: {
        ok: true,
        system: 'ShipShell',
        model: 'test-model',
        aiConfigured: true,
        workspace: '/workspace/shipshell',
      },
    });
  });

  await page.route('**/api/logbook', async (route) => {
    await route.fulfill({ json: { entries: [] } });
  });

  await page.route('**/api/terminal/state**', async (route) => {
    await route.fulfill({ json: { cwd: '/workspace/shipshell' } });
  });
}

async function installNativeBrowserStub(page: Page) {
  await page.addInitScript(() => {
    const anchor = {
      id: 'anchor-1',
      kind: 'underline',
      text: 'Continue checkout',
      tag: 'button',
      role: 'button',
      ariaLabel: 'Continue checkout',
      href: '',
      elementId: 'continue',
      testId: 'continue-button',
      name: 'continue',
      note: 'Primary action',
      resolved: true,
      rect: { x: 20, y: 30, width: 140, height: 44 },
      createdAt: '2026-08-16T10:00:00.000Z',
    };

    const state = {
      activeTabId: 'tab-1',
      tabs: [{
        id: 'tab-1',
        title: 'Demo checkout',
        url: 'https://example.test/checkout',
        loading: false,
        canGoBack: false,
        canGoForward: false,
      }],
    };

    Object.assign(window, {
      __shipShellFocusCalls: [] as number[][],
      shipShellBrowser: {
        isNative: true,
        navigate: async () => ({}),
        newTab: async () => ({}),
        selectTab: async () => ({}),
        closeTab: async () => ({}),
        back: async () => ({}),
        forward: async () => ({}),
        reload: async () => ({}),
        getPageContext: async () => ({
          available: true,
          title: 'Demo checkout',
          url: 'https://example.test/checkout',
          selection: 'Continue checkout',
          text: 'Order total $42. Continue checkout. Cancel.',
          anchors: [anchor],
          visual: { available: false, imageDataUrl: '' },
        }),
        setAnnotationMode: async (mode: string) => ({ mode, anchors: [anchor] }),
        clearAnnotations: async () => [],
        getAnnotations: async () => [anchor],
        setAnnotationNote: async () => [anchor],
        focusAnnotations: async (numbers: number[]) => {
          (window as unknown as { __shipShellFocusCalls: number[][] }).__shipShellFocusCalls.push(numbers);
          return { focused: numbers, anchors: [anchor] };
        },
        setBounds: () => undefined,
        setVisible: () => undefined,
        onState: (listener: (nextState: typeof state) => void) => {
          queueMicrotask(() => listener(state));
          return () => undefined;
        },
      },
    });
  });
}

test('Copilot sends bounded page context and focuses referenced anchors', async ({ page }) => {
  await installNativeBrowserStub(page);
  await mockBaseApi(page);

  let missionBody: Record<string, unknown> | undefined;
  await page.route('**/api/missions', async (route) => {
    missionBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      json: {
        decision: { kind: 'answer', normalizedInput: 'Resume esta página' },
        answer: 'La Ancla 1 es la acción principal del flujo.',
      },
    });
  });

  await page.goto('/');
  await expect(page.getByText('Demo checkout')).toBeVisible();

  await page.getByRole('button', { name: 'Resume esta página' }).click();

  await expect(page.getByText('La Ancla 1 es la acción principal del flujo.')).toBeVisible();
  await expect.poll(() => missionBody).toBeTruthy();

  const context = missionBody?.context as Record<string, unknown>;
  const profile = missionBody?.profile as Record<string, unknown>;
  expect(context.selection).toBe('Continue checkout');
  expect((context.anchors as Array<Record<string, unknown>>)[0].note).toBe('Primary action');
  expect(profile.activeModule).toBe('copilot');

  await expect.poll(async () => page.evaluate(() => (
    window as unknown as { __shipShellFocusCalls: number[][] }
  ).__shipShellFocusCalls)).toEqual([[1]]);
});

test('ShipSeal requires explicit approval before a write command runs', async ({ page }) => {
  await mockBaseApi(page);

  let previewBody: Record<string, unknown> | undefined;
  let approvalBody: Record<string, unknown> | undefined;
  let runBody: Record<string, unknown> | undefined;

  await page.route('**/api/terminal/preview', async (route) => {
    previewBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      json: {
        cwd: '/workspace/shipshell',
        decision: {
          allowed: true,
          requiresSeal: true,
          risk: 'write',
          executable: 'touch',
          args: ['proof.txt'],
          reason: 'This command changes the workspace.',
        },
        approval: {
          id: 'seal-test-1',
          fingerprint: 'fp-test-1',
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        },
      },
    });
  });

  await page.route('**/api/terminal/approve', async (route) => {
    approvalBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ json: { ok: true } });
  });

  await page.route('**/api/terminal/run-stream', async (route) => {
    runBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: 'application/x-ndjson',
      body: [
        JSON.stringify({ type: 'start', cwd: '/workspace/shipshell', decision: { allowed: true, requiresSeal: true, risk: 'write', reason: 'approved' } }),
        JSON.stringify({ type: 'stdout', data: 'sealed write executed\\n' }),
        JSON.stringify({ type: 'exit', exitCode: 0, cwd: '/workspace/shipshell' }),
      ].join('\n') + '\n',
    });
  });

  await page.goto('/');

  const terminal = page.locator('section[data-module="terminal"]');
  const command = terminal.getByLabel('Comando de terminal');
  await command.fill('touch proof.txt');
  await terminal.getByRole('button', { name: 'Ejecutar' }).click();

  await expect(terminal.getByText('MANIOBRA CON CAMBIOS')).toBeVisible();
  await expect(terminal.getByText('This command changes the workspace.')).toBeVisible();
  expect(previewBody?.command).toBe('touch proof.txt');
  expect(runBody).toBeUndefined();

  await terminal.getByRole('button', { name: 'Sellar y ejecutar' }).click();

  await expect(terminal.getByText('sealed write executed')).toBeVisible();
  expect(approvalBody?.id).toBe('seal-test-1');
  expect(approvalBody?.fingerprint).toBe('fp-test-1');
  expect(runBody?.command).toBe('touch proof.txt');
  expect(runBody?.sealId).toBe('seal-test-1');
});
