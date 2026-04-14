import { test, expect } from "@playwright/test";

const API_URL = "http://localhost:8080";

test.describe("Compressed Content Serving", () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    const resp = await request.post(`${API_URL}/api/auth/login`, {
      data: { email: "anshuman@biswas.me", password: "md27rV9oVfqOUnM7B4aT" },
    });
    if (!resp.ok()) {
      // Fallback password
      const resp2 = await request.post(`${API_URL}/api/auth/login`, {
        data: { email: "anshuman@biswas.me", password: "Learn2026!" },
      });
      const body = await resp2.json();
      token = body.token;
    } else {
      const body = await resp.json();
      token = body.token;
    }
    expect(token).toBeTruthy();
  });

  test.describe("API Content Decompression", () => {
    test("page content is served decompressed (not raw zlib)", async ({
      request,
    }) => {
      // Fetch a course to find a page
      const coursesResp = await request.get(`${API_URL}/api/courses`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const courses = await coursesResp.json();
      expect(courses.length).toBeGreaterThan(0);

      const course = courses[0];
      const courseResp = await request.get(
        `${API_URL}/api/courses/${course.slug}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const courseData = await courseResp.json();
      const sections = courseData.sections || [];
      expect(sections.length).toBeGreaterThan(0);

      // Find a section with pages
      const section = sections.find(
        (s: any) => s.pages && s.pages.length > 0
      );
      expect(section).toBeTruthy();

      const page = section.pages[0];
      const pageResp = await request.get(
        `${API_URL}/api/courses/${course.slug}/sections/${section.slug}/pages/${page.slug}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      expect(pageResp.ok()).toBe(true);

      const pageData = await pageResp.json();

      // Content must NOT start with "zlib:" — it must be decompressed
      expect(pageData.content).toBeDefined();
      expect(pageData.content).not.toMatch(/^zlib:/);

      // Content should be valid HTML/text
      expect(pageData.content.length).toBeGreaterThan(0);

      // content_html should also be present and valid
      if (pageData.content_html) {
        expect(pageData.content_html).not.toMatch(/^zlib:/);
        expect(pageData.content_html.length).toBeGreaterThan(0);
      }
    });

    test("all pages across courses serve decompressed content", async ({
      request,
    }) => {
      const coursesResp = await request.get(`${API_URL}/api/courses`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const courses = await coursesResp.json();

      // Sample 3 courses, 2 pages each
      const sampled = courses.slice(0, 3);
      for (const course of sampled) {
        const courseResp = await request.get(
          `${API_URL}/api/courses/${course.slug}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const courseData = await courseResp.json();

        const sections = (courseData.sections || []).filter(
          (s: any) => s.pages?.length > 0
        );
        if (sections.length === 0) continue;

        // Check first page of first 2 sections
        for (const section of sections.slice(0, 2)) {
          const page = section.pages[0];
          const pageResp = await request.get(
            `${API_URL}/api/courses/${course.slug}/sections/${section.slug}/pages/${page.slug}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          expect(pageResp.ok()).toBe(true);

          const pageData = await pageResp.json();
          expect(pageData.content).not.toMatch(/^zlib:/);
          expect(pageData.content.length).toBeGreaterThan(10);
        }
      }
    });

    test("page content roundtrips through edit correctly", async ({
      request,
    }) => {
      // Get a page
      const coursesResp = await request.get(`${API_URL}/api/courses`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const courses = await coursesResp.json();
      const course = courses[0];

      const courseResp = await request.get(
        `${API_URL}/api/courses/${course.slug}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const courseData = await courseResp.json();
      const section = courseData.sections.find(
        (s: any) => s.pages?.length > 0
      );
      const page = section.pages[0];

      // Read original content
      const readResp = await request.get(
        `${API_URL}/api/courses/${course.slug}/sections/${section.slug}/pages/${page.slug}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const original = (await readResp.json()).content;

      // Write modified content
      const modified = original + "\n\n<!-- compression test marker -->";
      const writeResp = await request.put(
        `${API_URL}/api/pages/${page.id}/content`,
        {
          headers: { Authorization: `Bearer ${token}` },
          data: { content: modified },
        }
      );
      expect(writeResp.ok()).toBe(true);

      // Read back — should be decompressed and match
      const readBack = await request.get(
        `${API_URL}/api/courses/${course.slug}/sections/${section.slug}/pages/${page.slug}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const readBackData = await readBack.json();
      expect(readBackData.content).toBe(modified);
      expect(readBackData.content).not.toMatch(/^zlib:/);

      // Restore original
      await request.put(`${API_URL}/api/pages/${page.id}/content`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { content: original },
      });
    });
  });

  test.describe("SVG Image Compression", () => {
    test("SVG images are served with gzip Content-Encoding", async ({
      request,
    }) => {
      // Find an SVG image reference from a page
      const coursesResp = await request.get(`${API_URL}/api/courses`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const courses = await coursesResp.json();

      let svgUrl: string | null = null;
      for (const course of courses) {
        const courseResp = await request.get(
          `${API_URL}/api/courses/${course.slug}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const courseData = await courseResp.json();

        for (const section of courseData.sections || []) {
          for (const page of section.pages || []) {
            const pageResp = await request.get(
              `${API_URL}/api/courses/${course.slug}/sections/${section.slug}/pages/${page.slug}`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            const pageData = await pageResp.json();
            const match = pageData.content?.match(
              /src="(\/images\/[a-f0-9]+\.svg)"/
            );
            if (match) {
              svgUrl = match[1];
              break;
            }
          }
          if (svgUrl) break;
        }
        if (svgUrl) break;
      }

      expect(svgUrl).toBeTruthy();

      // Request SVG with Accept-Encoding: gzip
      const svgResp = await request.get(`${API_URL}${svgUrl}`, {
        headers: { "Accept-Encoding": "gzip" },
      });
      expect(svgResp.ok()).toBe(true);
      expect(svgResp.headers()["content-type"]).toBe("image/svg+xml");
      expect(svgResp.headers()["content-encoding"]).toBe("gzip");
      expect(svgResp.headers()["cache-control"]).toContain("immutable");
    });

    test("SVG renders correctly in browser after gzip decompression", async ({
      page,
    }) => {
      // Set auth token
      await page.goto(API_URL);
      await page.evaluate((t) => localStorage.setItem("learn_token", t), token);

      // Find a course page with SVG images
      const coursesResp = await page.request.get(`${API_URL}/api/courses`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const courses = await coursesResp.json();
      const course = courses.find(
        (c: any) => c.slug === "3d-machine-learning-with-pytorch3d"
      );

      if (!course) {
        test.skip();
        return;
      }

      // Navigate to a page known to have SVGs
      await page.goto(
        `${API_URL}/courses/${course.slug}/cameras-and-projection/image-formation-and-the-thin-lens-equation`
      );
      await page.waitForTimeout(3000);

      // Check that SVG images loaded (naturalWidth > 0 means loaded)
      const svgImages = page.locator('img[src$=".svg"]');
      const count = await svgImages.count();

      if (count > 0) {
        for (let i = 0; i < Math.min(count, 3); i++) {
          const img = svgImages.nth(i);
          const naturalWidth = await img.evaluate(
            (el: HTMLImageElement) => el.naturalWidth
          );
          expect(naturalWidth).toBeGreaterThan(0);
        }
      }
    });

    test("PNG images still serve normally (no gzip)", async ({ request }) => {
      // Find a PNG image
      const coursesResp = await request.get(`${API_URL}/api/courses`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const courses = await coursesResp.json();

      let pngUrl: string | null = null;
      for (const course of courses) {
        const courseResp = await request.get(
          `${API_URL}/api/courses/${course.slug}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const courseData = await courseResp.json();

        for (const section of courseData.sections || []) {
          for (const page of section.pages || []) {
            const pageResp = await request.get(
              `${API_URL}/api/courses/${course.slug}/sections/${section.slug}/pages/${page.slug}`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            const pageData = await pageResp.json();
            const match = pageData.content?.match(
              /src="(\/images\/[a-f0-9]+\.(?:png|jpg))"/
            );
            if (match) {
              pngUrl = match[1];
              break;
            }
          }
          if (pngUrl) break;
        }
        if (pngUrl) break;
      }

      if (!pngUrl) {
        test.skip();
        return;
      }

      const pngResp = await request.get(`${API_URL}${pngUrl}`);
      expect(pngResp.ok()).toBe(true);
      // PNG should NOT have content-encoding gzip (it's already compressed)
      expect(pngResp.headers()["content-encoding"]).toBeUndefined();
    });
  });
});
