import { test, expect } from "@playwright/test";

const BASE = "http://localhost:8080";

test("login on Go server, see courses, click into one", async ({ page }) => {
  // Step 1: Go to homepage
  await page.goto(BASE);
  await page.screenshot({ path: "test-screenshots/01-homepage.png" });

  // Step 2: Click Login
  const loginLink = page.locator('a[href="/auth/login"]');
  await expect(loginLink).toBeVisible({ timeout: 5000 });
  await loginLink.click();
  await page.waitForURL("**/auth/login**", { timeout: 5000 });
  await page.screenshot({ path: "test-screenshots/02-login-page.png" });

  // Step 3: Fill credentials and submit
  await page.fill('input[placeholder*="email" i], input[type="email"]', "anshuman@biswas.me");
  await page.fill('input[placeholder*="password" i], input[type="password"]', "Learn2026!");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "test-screenshots/03-after-login.png" });

  const url = page.url();
  console.log("After login URL:", url);

  // Step 4: Go to homepage to see courses
  await page.goto(BASE);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "test-screenshots/04-homepage-logged-in.png" });

  // Step 5: Check if course cards are visible
  const courseCards = page.locator('a[href*="/courses/"]');
  const cardCount = await courseCards.count();
  console.log("Course cards found:", cardCount);

  if (cardCount === 0) {
    // Check what's on the page
    const bodyText = await page.textContent("body");
    console.log("Page body (first 500 chars):", bodyText?.substring(0, 500));

    // Check if courses API returns data
    const token = await page.evaluate(() => localStorage.getItem("learn_token"));
    console.log("Token in localStorage:", token ? `${token.substring(0, 20)}...` : "NONE");

    // Try fetching courses directly
    const apiResp = await page.evaluate(async () => {
      const token = localStorage.getItem("learn_token");
      const resp = await fetch("/api/courses", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      return { status: resp.status, body: await resp.text() };
    });
    console.log("API /api/courses:", apiResp.status, apiResp.body.substring(0, 200));
  }

  expect(cardCount).toBeGreaterThan(0);

  // Step 6: Click the first course
  const firstCard = courseCards.first();
  const href = await firstCard.getAttribute("href");
  console.log("Clicking course with href:", href);
  await firstCard.click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "test-screenshots/05-after-click.png" });

  const afterClickUrl = page.url();
  console.log("After click URL:", afterClickUrl);

  // Should have navigated away from home
  expect(afterClickUrl).toContain("/courses/");
  expect(afterClickUrl).not.toBe(BASE + "/");

  // Step 7: Debug what happened
  await page.waitForTimeout(2000);

  // Check token
  const tokenAfterNav = await page.evaluate(() => localStorage.getItem("learn_token"));
  console.log("Token after nav:", tokenAfterNav ? `${tokenAfterNav.substring(0, 20)}...` : "NONE");

  // Check what the API returned
  const apiDebug = await page.evaluate(async () => {
    const token = localStorage.getItem("learn_token");
    const slug = window.location.pathname.split("/courses/")[1]?.replace(/\/$/, "");
    if (!slug) return { error: "no slug in URL" };
    const resp = await fetch(`/api/courses/${slug}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const body = await resp.text();
    return { status: resp.status, body: body.substring(0, 300), slug };
  });
  console.log("API debug:", JSON.stringify(apiDebug));

  // Check page content
  const bodyText = await page.textContent("body");
  console.log("Body text (first 200):", bodyText?.substring(0, 200));

  await page.screenshot({ path: "test-screenshots/06-course-page.png" });

  // The test should show the course, not "Course not found"
  expect(bodyText).not.toContain("Course not found");
});
