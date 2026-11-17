import { chromium, firefox } from '@playwright/test';

const failure = code => Object.assign(new Error(code), { recoveryCode: code });

// Synthetic compiled-app acceptance only. Never load a developer profile,
// production URL, account credential, trace or external provider resource.
export async function verifyOperatorBrowserAdmission(origin, code, { browser: browserName, scenario }) {
  const url = new URL(origin);
  if (url.protocol !== 'http:' || url.hostname !== 'localhost' || url.pathname !== '/' || url.search || url.hash || url.username || url.password || !/^[A-Za-z0-9_-]{43}$/.test(code) || !['chromium', 'firefox'].includes(browserName) || !['wrong-code', 'lifecycle'].includes(scenario)) {
    throw failure('OPERATOR_BROWSER_SYNTHETIC_CONTEXT_REQUIRED');
  }
  const results = [];
  for (const [name, engine] of [[browserName, browserName === 'chromium' ? chromium : firefox]]) {
    let browser;
    let stage = 'LAUNCH';
    try {
      browser = await engine.launch();
      stage = 'CONTEXT';
      const context = await browser.newContext({ serviceWorkers: 'block' });
      await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      await context.routeWebSocket('**/*', socket => socket.close());
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      const entry = origin + '/api/release/access';
      stage = 'PUBLIC_BOUNDARY';
      const publicAccount = await context.request.get(origin + '/api/user/profile');
      if (publicAccount.status() !== 503) throw failure('OPERATOR_BROWSER_PUBLIC_ACCESS_EXPOSED');
      await publicAccount.dispose();

      // Real form navigation supplies its own Origin. Manually adding that
      // header to an HTTP probe would miss the no-referrer/null-origin bug.
      stage = 'FORM_NAVIGATION';
      await page.goto(entry, { waitUntil: 'domcontentloaded' });
      if (scenario === 'wrong-code') {
        await page.getByLabel('Access code').fill('A'.repeat(43));
        stage = 'WRONG_CODE_SUBMISSION';
        const wrongResponse = page.waitForResponse(response => response.url() === entry && response.request().method() === 'POST');
        await page.getByRole('button', { name: 'Continue', exact: true }).click();
        const status = (await wrongResponse).status();
        if (status !== 401) throw failure('OPERATOR_BROWSER_WRONG_CODE_STATUS_' + status);
        const stillHeld = await context.request.get(origin + '/api/user/profile');
        if (stillHeld.status() !== 503) throw failure('OPERATOR_BROWSER_WRONG_CODE_GRANTED_ACCESS');
        await stillHeld.dispose();
        await context.close();
        results.push({ browser: name, scenario, wrongCode: 401, publicHeld: 503 });
        continue;
      }
      await page.getByLabel('Access code').fill(code);
      stage = 'VALID_CODE_SUBMISSION';
      const admitted = page.waitForResponse(response => response.url() === entry && response.request().method() === 'POST');
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      const status = (await admitted).status();
      if (status !== 303) throw failure('OPERATOR_BROWSER_ENTRY_STATUS_' + status);
      await page.waitForURL(origin + '/', { waitUntil: 'domcontentloaded' });
      stage = 'ACCOUNT_BOUNDARY';
      const account = await context.request.get(origin + '/api/user/profile');
      if (account.status() !== 401) throw failure('OPERATOR_BROWSER_ACCOUNT_BOUNDARY_FAILED');
      await account.dispose();

      stage = 'SEPARATE_BROWSER_BOUNDARY';
      const anonymous = await browser.newContext();
      const stillHeld = await anonymous.request.get(origin + '/api/user/profile');
      if (stillHeld.status() !== 503) throw failure('OPERATOR_BROWSER_ADMISSION_BECAME_GLOBAL');
      await stillHeld.dispose();
      await anonymous.close();

      await page.goto(entry, { waitUntil: 'domcontentloaded' });
      stage = 'EXIT_SUBMISSION';
      const ended = page.waitForResponse(response => response.url() === entry && response.request().method() === 'POST');
      await page.getByRole('button', { name: 'End operator access', exact: true }).click();
      const exitStatus = (await ended).status();
      if (exitStatus !== 303) throw failure('OPERATOR_BROWSER_EXIT_STATUS_' + exitStatus);
      await page.waitForURL(origin + '/', { waitUntil: 'domcontentloaded' });
      stage = 'EXIT_BOUNDARY';
      const afterExit = await context.request.get(origin + '/api/user/profile');
      if (afterExit.status() !== 503) throw failure('OPERATOR_BROWSER_EXIT_DID_NOT_REVOKE_ACCESS');
      await afterExit.dispose();
      await context.close();
      results.push({ browser: name, scenario, entry: 303, accountStillRequiresSignIn: 401, publicHeld: 503, afterExit: 503 });
    } catch (error) {
      // Only constant phase identifiers reach CI output, never form values,
      // cookies, request headers, URLs or a raw browser exception.
      throw failure(error?.recoveryCode ?? 'OPERATOR_BROWSER_' + name.toUpperCase() + '_' + stage + '_FAILED');
    } finally {
      await browser?.close();
    }
  }
  return results;
}
