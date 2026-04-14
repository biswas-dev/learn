import { test, expect } from "@playwright/test";

const BASE = "http://localhost:8080";

test("dashboard course edit page loads correctly", async ({ page }) => {
  // Login
  await page.goto(BASE);
  await page.evaluate(() => {
    // Login via API to get token
    return fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "anshuman@biswas.me", password: "Learn2026!" }),
    })
      .then((r) => r.json())
      .then((d) => localStorage.setItem("learn_token", d.token));
  });

  // Navigate to dashboard/courses/15
  await page.goto(`${BASE}/dashboard/courses/15`);
  await page.waitForTimeout(3000);

  // Debug: check what's on the page
  const bodyText = await page.textContent("body");
  console.log("Body text:", bodyText?.substring(0, 300));

  // Debug: check the URL params the component sees
  const debug = await page.evaluate(() => {
    const pathname = window.location.pathname;
    const parts = pathname.split("/").filter(Boolean);
    const idx = parts.indexOf("courses");
    const courseId = idx >= 0 ? parts[idx + 1] : "NOT FOUND";

    // Also try the API call
    const token = localStorage.getItem("learn_token");
    return fetch("/api/courses", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((courses) => {
        const ids = courses.map((c: any) => ({ id: c.id, title: c.title }));
        const match = courses.find((c: any) => String(c.id) === courseId);
        return {
          pathname,
          parts,
          courseId,
          coursesCount: courses.length,
          courseIds: ids,
          match: match ? { id: match.id, slug: match.slug } : null,
        };
      });
  });
  console.log("Debug:", JSON.stringify(debug, null, 2));

  // Should NOT show "Course not found"
  expect(bodyText).not.toContain("Course not found");
});
