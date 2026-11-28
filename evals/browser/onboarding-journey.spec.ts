import { test, expect, type Page } from "@playwright/test";

// Exercise the real AuthProvider, form and router after authentication, while
// replacing the account/API boundary. No OAuth credentials or live services.
async function syntheticAccount(page: Page, baseURL: string, conflict = false) {
  const origin = new URL(baseURL).origin;
  let user = {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Synthetic Writer",
    username: null as string | null,
    email: "writer@example.com",
    auth_provider: "google",
    is_onboarded: false,
    wallet_address: null,
    avatar: null,
    subscription_plan: "free",
  };
  const writes: unknown[] = [];
  const unexpectedWrites: string[] = [];
  await page.context().route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin) return route.abort();
    if (!url.pathname.startsWith("/api/")) return route.continue();
    if (url.pathname === "/api/user/profile")
      return route.fulfill({ json: { user } });
    if (url.pathname === "/api/auth/refresh")
      return route.fulfill({
        json: { access_token: "synthetic-post-auth-token" },
      });
    if (url.pathname === "/api/auth/onboarding") {
      expect(request.method()).toBe("POST");
      const data = request.postDataJSON();
      writes.push(data);
      expect(data).toMatchObject({
        userId: user.id,
        name: "Synthetic Writer",
        email: "writer@example.com",
      });
      if (conflict && writes.length === 1)
        return route.fulfill({
          status: 409,
          json: { error: "Username is not available" },
        });
      user = {
        ...user,
        name: data.name,
        username: data.username,
        email: data.email,
        is_onboarded: true,
      };
      return route.fulfill({ json: { success: true, user } });
    }
    if (request.method() !== "GET") {
      unexpectedWrites.push(url.pathname);
      return route.abort();
    }
    return route.fulfill({
      json: { notifications: [], stories: [], habits: [] },
    });
  });
  return { writes, unexpectedWrites };
}

test("new authenticated account completes its profile and stays onboarded after reload", async ({
  page,
  baseURL,
}) => {
  const fixture = await syntheticAccount(page, baseURL!);
  await page.goto("/");
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Synthetic Writer",
  );
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue(
    "writer@example.com",
  );
  await page.getByLabel("Username", { exact: true }).fill("synthetic_writer");
  await page.getByRole("button", { name: "Open my home feed" }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(
    page.getByRole("heading", { name: "Your next chapter starts here." }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Your next chapter starts here." }),
  ).toBeVisible();
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/home$/);
  expect(fixture.writes).toHaveLength(1);
  expect(fixture.unexpectedWrites).toEqual([]);
});

test("a username conflict retains the profile and supports a successful retry", async ({
  page,
  baseURL,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const fixture = await syntheticAccount(page, baseURL!, true);
  await page.goto("/onboarding");
  await page.getByLabel("Username", { exact: true }).fill("reserved_writer");
  await page.getByRole("button", { name: "Open my home feed" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Your profile could not be saved" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Synthetic Writer",
  );
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue(
    "writer@example.com",
  );
  await expect(page.getByLabel("Username", { exact: true })).toHaveValue(
    "reserved_writer",
  );
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.getByLabel("Username", { exact: true }).fill("available_writer");
  await page.getByRole("button", { name: "Open my home feed" }).click();
  await expect(page).toHaveURL(/\/home$/);
  expect(fixture.writes).toHaveLength(2);
  expect(fixture.unexpectedWrites).toEqual([]);
});
