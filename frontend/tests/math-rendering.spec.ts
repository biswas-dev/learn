import { test, expect } from "@playwright/test";

const API_URL = "http://localhost:8080";

test.describe("Math / KaTeX Rendering", () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    const resp = await request.post(`${API_URL}/api/auth/login`, {
      data: { email: "anshuman@biswas.me", password: "md27rV9oVfqOUnM7B4aT" },
    });
    if (!resp.ok()) {
      const resp2 = await request.post(`${API_URL}/api/auth/login`, {
        data: { email: "anshuman@biswas.me", password: "Learn2026!" },
      });
      token = (await resp2.json()).token;
    } else {
      token = (await resp.json()).token;
    }
    expect(token).toBeTruthy();
  });

  test("KaTeX CSS is loaded on page", async ({ page }) => {
    await page.goto(API_URL);
    await page.evaluate((t) => localStorage.setItem("learn_token", t), token);
    await page.goto(
      `${API_URL}/courses/grokking-dynamic-programming-interview/longest-common-substring/introduction-to-longest-common-substring`
    );
    await page.waitForTimeout(3000);

    // KaTeX stylesheet should be loaded
    const katexCss = await page.evaluate(() => {
      const links = document.querySelectorAll('link[rel="stylesheet"]');
      return Array.from(links).some((l) =>
        l.getAttribute("href")?.includes("katex")
      );
    });
    expect(katexCss).toBe(true);
  });

  test("KaTeX spans are present in rendered page", async ({ page }) => {
    await page.goto(API_URL);
    await page.evaluate((t) => localStorage.setItem("learn_token", t), token);
    await page.goto(
      `${API_URL}/courses/grokking-dynamic-programming-interview/longest-common-substring/introduction-to-longest-common-substring`
    );
    await page.waitForTimeout(3000);

    // Page should contain .katex elements
    const katexCount = await page.locator(".katex").count();
    expect(katexCount).toBeGreaterThan(0);
  });

  test("raw LaTeX source is NOT visible on page", async ({ page }) => {
    await page.goto(API_URL);
    await page.evaluate((t) => localStorage.setItem("learn_token", t), token);
    await page.goto(
      `${API_URL}/courses/grokking-dynamic-programming-interview/longest-common-substring/introduction-to-longest-common-substring`
    );
    await page.waitForTimeout(3000);

    // Raw LaTeX commands should NOT be visually visible
    // (they may exist in hidden .katex-mathml elements, but not in visible text)
    const visibleText = await page.evaluate(() => {
      // Get text only from visible elements, excluding hidden .katex-mathml
      const clone = document.body.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('.katex-mathml, [style*="display: none"], [hidden]').forEach(el => el.remove());
      return clone.textContent || '';
    });

    expect(visibleText).not.toContain("\\begin{cases}");
    expect(visibleText).not.toContain("\\lbrace");
    expect(visibleText).not.toContain("\\neq");
    expect(visibleText).not.toContain("\\end{cases}");
    expect(visibleText).not.toContain("application/x-tex");
  });

  test("math formulas render with proper dimensions (not collapsed)", async ({
    page,
  }) => {
    await page.goto(API_URL);
    await page.evaluate((t) => localStorage.setItem("learn_token", t), token);
    await page.goto(
      `${API_URL}/courses/grokking-dynamic-programming-interview/longest-common-substring/introduction-to-longest-common-substring`
    );
    await page.waitForTimeout(3000);

    // KaTeX elements should have visible dimensions (not 0x0)
    const katexElements = page.locator(".katex-html");
    const count = await katexElements.count();

    if (count > 0) {
      for (let i = 0; i < Math.min(count, 3); i++) {
        const box = await katexElements.nth(i).boundingBox();
        expect(box).toBeTruthy();
        expect(box!.width).toBeGreaterThan(10);
        expect(box!.height).toBeGreaterThan(5);
      }
    }
  });

  test(".katex-mathml (MathML source) is hidden", async ({ page }) => {
    await page.goto(API_URL);
    await page.evaluate((t) => localStorage.setItem("learn_token", t), token);
    await page.goto(
      `${API_URL}/courses/grokking-dynamic-programming-interview/longest-common-substring/introduction-to-longest-common-substring`
    );
    await page.waitForTimeout(3000);

    // .katex-mathml should exist in DOM but not be visible
    const mathmlElements = page.locator(".katex-mathml");
    const count = await mathmlElements.count();

    if (count > 0) {
      for (let i = 0; i < Math.min(count, 3); i++) {
        const visible = await mathmlElements.nth(i).isVisible();
        expect(visible).toBe(false);
      }
    }
  });
});
