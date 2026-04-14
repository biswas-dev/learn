import { test, expect } from "@playwright/test";

const BASE = "http://localhost:8080";

test("page editor loads content for pages without versions", async ({ page }) => {
  // Login
  await page.goto(BASE);
  await page.evaluate(() =>
    fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "anshuman@biswas.me", password: "Learn2026!" }),
    })
      .then((r) => r.json())
      .then((d) => localStorage.setItem("learn_token", d.token)),
  );

  // Navigate to page editor (page 231 has content but 0 versions)
  await page.goto(`${BASE}/dashboard/courses/15/sections/113/pages/231`);
  await page.waitForTimeout(4000);

  // The textarea should have content (not empty / placeholder)
  const textarea = page.locator("[data-wiki-textarea]");
  await expect(textarea).toBeVisible({ timeout: 10000 });
  const value = await textarea.inputValue();
  console.log("Textarea content length:", value.length);
  console.log("First 200 chars:", value.substring(0, 200));

  expect(value.length).toBeGreaterThan(100);

  // The page title should be visible
  const title = await page.textContent("body");
  expect(title).toContain("GenAI System Design Interview Preparation");
});

test("page editor shows split view with preview", async ({ page }) => {
  await page.goto(BASE);
  await page.evaluate(() =>
    fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "anshuman@biswas.me", password: "Learn2026!" }),
    })
      .then((r) => r.json())
      .then((d) => localStorage.setItem("learn_token", d.token)),
  );

  await page.goto(`${BASE}/dashboard/courses/15/sections/113/pages/231`);
  await page.waitForTimeout(4000);

  // Should see MARKDOWN and PREVIEW pane labels (full mode is default)
  const markdownLabel = page.locator("text=Markdown >> nth=0");
  const previewLabel = page.locator("span:text-is('Preview')");
  await expect(markdownLabel).toBeVisible({ timeout: 5000 });
  await expect(previewLabel).toBeVisible({ timeout: 5000 });

  // Debug: manually test the preview API
  const apiResult = await page.evaluate(async () => {
    const token = localStorage.getItem("learn_token");
    const textarea = document.querySelector("[data-wiki-textarea]") as HTMLTextAreaElement;
    const content = textarea?.value?.substring(0, 200) || "";
    const resp = await fetch("/api/wiki/preview", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ content }),
    });
    return { status: resp.status, body: (await resp.text()).substring(0, 200), contentLen: content.length };
  });
  console.log("Preview API test:", JSON.stringify(apiResult));

  // Wait for preview to render (debounced 400ms + API call)
  await page.waitForTimeout(3000);
  const previewPane = page.locator(".ln-prose").last();
  await expect(previewPane).toBeVisible({ timeout: 10000 });
  const previewText = await previewPane.textContent();
  console.log("Preview content length:", previewText?.length);
  console.log("Preview first 100:", previewText?.substring(0, 100));
  expect(previewText!.length).toBeGreaterThan(50);
});
