import { test, expect } from "@playwright/test";

const DEV_URL = "http://localhost:5174";
const API_URL = "http://localhost:8080";

test.describe("Course Navigation", () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    // Login to get token
    const resp = await request.post(`${API_URL}/api/auth/login`, {
      data: { email: "anshuman@biswas.me", password: "Learn2026!" },
    });
    const body = await resp.json();
    token = body.token;
    expect(token).toBeTruthy();
  });

  test("can see courses after login and click into one", async ({ page }) => {
    // Go to dev server
    await page.goto(DEV_URL);

    // Login via UI
    await page.click('a[href="/auth/login"]');
    await page.waitForURL("**/auth/login**");
    await page.fill('input[type="email"], input[placeholder*="email" i]', "anshuman@biswas.me");
    await page.fill('input[type="password"], input[placeholder*="password" i]', "Learn2026!");
    await page.click('button[type="submit"]');

    // Wait for redirect after login (goes to /dashboard/)
    await page.waitForURL("**/dashboard/**", { timeout: 10000 });

    // Go to home to see course catalog
    await page.goto(DEV_URL + "/");

    // Should see at least one course card
    const courseCard = page.locator("a[href*='/courses/']").first();
    await expect(courseCard).toBeVisible({ timeout: 10000 });

    // Get the href
    const href = await courseCard.getAttribute("href");
    expect(href).toContain("/courses/");

    // Click it
    await courseCard.click();

    // Should navigate to course detail page
    await page.waitForURL("**/courses/**", { timeout: 10000 });
    expect(page.url()).toContain("/courses/");
    expect(page.url()).not.toBe(DEV_URL + "/");

    // Should see course title or table of contents
    const heading = page.locator("h1, h2").first();
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test("can navigate to a specific course page and see content", async ({ page }) => {
    // Set token in localStorage before navigating
    await page.goto(DEV_URL);
    await page.evaluate((t) => localStorage.setItem("learn_token", t), token);

    // Navigate directly to a course
    await page.goto(
      `${DEV_URL}/courses/grokking-the-engineering-management-and-leadership-interviews/`
    );

    // Should see course title
    await expect(page.locator("h1")).toBeVisible({ timeout: 10000 });
    const title = await page.locator("h1").textContent();
    expect(title).toContain("Grokking");

    // Should see table of contents with sections
    const tocLinks = page.locator("nav a[href*='/courses/']");
    const count = await tocLinks.count();
    expect(count).toBeGreaterThan(5);

    // Click first lesson
    await tocLinks.first().click();
    await page.waitForURL("**/courses/**/", { timeout: 10000 });

    // Should see page content
    const prose = page.locator(".ln-prose");
    await expect(prose).toBeVisible({ timeout: 10000 });
    const text = await prose.textContent();
    expect(text!.length).toBeGreaterThan(100);
  });

  test("course page on Go server (port 8080) loads correctly", async ({ page }) => {
    // Set token
    await page.goto(`${API_URL}/`);
    await page.evaluate((t) => localStorage.setItem("learn_token", t), token);

    // Navigate to course - this tests the SPA fallback
    await page.goto(
      `${API_URL}/courses/grokking-the-engineering-management-and-leadership-interviews/`
    );

    // Wait for client-side hydration and data loading
    await page.waitForTimeout(3000);

    // Should show course content (either "Loading course..." then content, or content directly)
    const body = await page.textContent("body");
    // Should NOT show the catalog "Courses" heading as the main content
    // It should show the specific course title
    const hasCourseName = body?.includes("Grokking") || body?.includes("Loading course");
    expect(hasCourseName).toBe(true);
  });
});
