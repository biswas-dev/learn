/**
 * Extract MxGraph image URLs from educative.io pages.
 * Uses ONE browser to navigate all pages and extract <object data=...> URLs.
 *
 * Input: JSON file with {course_url, pages: [slug, ...]}
 * Output (stdout, last line): JSON {slug: [url, ...], ...}
 */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const cookieFile = process.env.COOKIE_FILE || path.join(process.env.HOME, '.config/go-educative/cookie.txt');
const inputFile = process.argv[2];
if (!inputFile) { console.error('Usage: node extract-mxgraph.js <pages.json>'); process.exit(1); }

const input = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));
const courseUrl = input.course_url.replace(/\/$/, '');
const pageSlugs = input.pages;

(async () => {
  const cookieStr = fs.readFileSync(cookieFile, 'utf-8').trim();
  const cookies = cookieStr.split('; ').map(c => {
    const [name, ...rest] = c.split('=');
    return { name: name.trim(), value: rest.join('='), domain: '.educative.io', path: '/' };
  });

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  await ctx.addCookies(cookies);

  const page = await ctx.newPage();
  await page.route('**/*.{woff,woff2,ttf,eot}', r => r.abort());

  const results = {};

  for (let i = 0; i < pageSlugs.length; i++) {
    const slug = pageSlugs[i];
    console.error(`[${i+1}/${pageSlugs.length}] ${slug}`);
    try {
      await page.goto(`${courseUrl}/${slug}`, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Scroll to trigger lazy loading
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 500) {
          window.scrollTo(0, y);
          await new Promise(r => setTimeout(r, 80));
        }
      });
      await page.waitForTimeout(2000);

      // Extract image URLs from <object data="..."> tags
      const urls = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('object[data*="/image/"]'))
          .map(o => o.getAttribute('data'))
          .filter(Boolean);
      });

      results[slug] = urls;
      if (urls.length > 0) console.error(`  → ${urls.length} images`);
    } catch (e) {
      console.error(`  → error: ${e.message}`);
      results[slug] = [];
    }
  }

  await browser.close();
  console.log(JSON.stringify(results));
})();
