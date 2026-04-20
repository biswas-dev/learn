import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";
import { get } from "~/lib/api";
import type { Course } from "~/lib/types";

/** Deterministic cover color from title */
function tintFor(title: string): string {
  const colors = ["#8A6B4A","#6A7F8C","#8C7A6B","#5E6E58","#8A5F5F","#6A5F8A","#7A8A4A","#4A6A7A","#9A7A4A","#6E5A7F"];
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0;
  return colors[h % colors.length];
}

export default component$(() => {
  const courses = useSignal<Course[]>([]);
  const loading = useSignal(true);

  useVisibleTask$(() => {
    get<Course[]>("/courses")
      .then((data) => { courses.value = data; })
      .catch(() => {})
      .finally(() => { loading.value = false; });
  });

  const totalPages = courses.value.reduce(
    (acc, c) => acc + (c.page_count ?? 0), 0
  );

  return (
    <div style={{ background: "var(--color-paper)", minHeight: "100vh", color: "var(--color-ink)" }}>
      {/* Hero */}
      <section style={{
        maxWidth: "1200px", margin: "0 auto", padding: "60px 32px 40px",
        display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: "80px", alignItems: "center",
      }}>
        <div>
          <div class="ln-eyebrow">
            <span class="dot">●</span> &nbsp; A quiet place to learn
          </div>
          <h1 class="ln-display">
            One book.<br/>
            One chapter.<br/>
            <em>One sitting.</em>
          </h1>
          <p style={{
            maxWidth: "460px", marginTop: "28px", fontSize: "16.5px", lineHeight: 1.55,
            color: "var(--color-ink-2)",
          }}>
            Learn is a calm reading room for technical books and courses.
            No infinite shelves, no streak pressure — just the next chapter,
            waiting for you.
          </p>
          <div style={{ display: "flex", gap: "10px", marginTop: "36px" }}>
            <Link href="/dashboard" class="ln-btn ln-btn-primary">
              Open your library
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            </Link>
            <Link href="#session" class="ln-btn ln-btn-ghost">See a sample session</Link>
          </div>
          {!loading.value && courses.value.length >= 10 && (
            <div class="mono" style={{
              marginTop: "28px", fontSize: "11.5px", color: "var(--color-ink-3)",
              display: "flex", gap: "24px",
            }}>
              <span>▲ {courses.value.length} courses</span>
              <span>▲ {totalPages.toLocaleString()} pages</span>
            </div>
          )}
        </div>

        {/* Hero art — animated SVG scene */}
        <div style={{ position: "relative", height: "520px" }}>
          <svg class="hero-svg" viewBox="0 0 520 520" width="100%" height="100%" style={{ borderRadius: "3px", overflow: "hidden" }}>
            <defs>
              {/* Grid pattern */}
              <pattern id="hero-grid" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
                <path d="M32 0V32H0" fill="none" stroke="var(--color-rule-soft)" stroke-width="0.5" opacity="0.5"/>
              </pattern>
              {/* Book spine shadow */}
              <linearGradient id="spine-shadow" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stop-color="#000" stop-opacity="0.12"/>
                <stop offset="100%" stop-color="#000" stop-opacity="0"/>
              </linearGradient>
              {/* Page texture */}
              <pattern id="page-lines" x="0" y="0" width="4" height="3" patternUnits="userSpaceOnUse">
                <rect width="4" height="1" fill="#000" opacity="0.04"/>
              </pattern>
            </defs>

            {/* Background */}
            <rect width="520" height="520" fill="var(--color-paper-2)" rx="3"/>
            <rect width="520" height="520" fill="url(#hero-grid)"/>

            {/* === BOOK COVERS (center) === */}
            <g transform="translate(155, 120)">
              {/* Left book */}
              <g style={{ animation: "hero-float-1 6s ease-in-out infinite" }}>
                <rect width="100" height="140" rx="2" fill="#C88A4A"/>
                <rect width="100" height="140" rx="2" fill="url(#page-lines)" opacity="0.6"/>
                <rect width="5" height="140" fill="url(#spine-shadow)"/>
                <text x="12" y="18" fill="rgba(255,255,255,0.7)" font-size="5.5" letter-spacing="0.12em" class="mono-text">LEARN</text>
                <text x="12" y="115" fill="rgba(255,255,255,0.92)" font-size="11" class="serif-text" style={{ lineHeight: 1.15 }}>
                  <tspan x="12">Programmer's</tspan>
                  <tspan x="12" dy="14">Guide to</tspan>
                  <tspan x="12" dy="14">AWS S3</tspan>
                </text>
              </g>

              {/* Spine divider */}
              <rect x="103" y="0" width="3" height="140" fill="var(--color-ink-4)" opacity="0.15" style={{ animation: "hero-float-1 6s ease-in-out infinite" }}/>

              {/* Right book */}
              <g transform="translate(109, 0)" style={{ animation: "hero-float-2 7s ease-in-out infinite" }}>
                <rect width="100" height="140" rx="2" fill="#5E6E58"/>
                <rect width="100" height="140" rx="2" fill="url(#page-lines)" opacity="0.6"/>
                <rect width="5" height="140" fill="url(#spine-shadow)"/>
                <text x="12" y="18" fill="rgba(255,255,255,0.7)" font-size="5.5" letter-spacing="0.12em" class="mono-text">LEARN</text>
                <text x="12" y="105" fill="rgba(255,255,255,0.92)" font-size="11" class="serif-text">
                  <tspan x="12">Hands-on</tspan>
                  <tspan x="12" dy="14">Guide to</tspan>
                  <tspan x="12" dy="14">Angular</tspan>
                </text>
              </g>
            </g>

            {/* === NOW READING card (top-left, floating) === */}
            <g style={{ animation: "hero-float-3 5s ease-in-out infinite" }}>
              <rect x="20" y="20" width="195" height="95" rx="3" fill="var(--color-paper)" stroke="var(--color-rule)" stroke-width="1"/>
              <text x="34" y="42" fill="var(--color-ink-3)" font-size="6" letter-spacing="0.14em" class="mono-text">NOW READING</text>
              <text x="34" y="58" fill="var(--color-ink)" font-size="10.5" class="serif-text" font-weight="400">
                <tspan x="34">Chapter 11 — Security,</tspan>
                <tspan x="34" dy="14">Access Control &amp; Policies</tspan>
              </text>
              {/* Animated progress bar */}
              <rect x="34" y="85" width="130" height="2" rx="1" fill="var(--color-rule)"/>
              <rect x="34" y="85" width="130" height="2" rx="1" fill="var(--color-accent)">
                <animate attributeName="width" from="20" to="90" dur="8s" repeatCount="indefinite" values="20;50;65;90;90;20" keyTimes="0;0.3;0.5;0.8;0.95;1" dur="12s"/>
              </rect>
              {/* Page counter */}
              <text x="172" y="89" fill="var(--color-ink-3)" font-size="6" class="mono-text" text-anchor="end">
                <animate attributeName="textContent" values="32%;48%;65%;82%;82%;32%" keyTimes="0;0.3;0.5;0.8;0.95;1" dur="12s" repeatCount="indefinite"/>
              </text>
            </g>

            {/* === CONTENT PREVIEW (right side, scrolling text) === */}
            <g transform="translate(310, 140)" style={{ animation: "hero-float-2 8s ease-in-out infinite" }}>
              <rect x="0" y="0" width="185" height="200" rx="3" fill="var(--color-paper)" stroke="var(--color-rule)" stroke-width="1"/>
              <clipPath id="content-clip"><rect x="2" y="2" width="181" height="196" rx="2"/></clipPath>
              <g clip-path="url(#content-clip)">
                <g>
                  <animateTransform attributeName="transform" type="translate" values="0,0;0,-50;0,-50;0,0" keyTimes="0;0.4;0.8;1" dur="10s" repeatCount="indefinite"/>
                  {/* Simulated text lines */}
                  <text x="14" y="22" fill="var(--color-ink)" font-size="8.5" font-weight="600">Security Fundamentals</text>
                  <rect x="14" y="30" width="155" height="1" rx="0.5" fill="var(--color-rule-soft)"/>
                  {/* Paragraph lines */}
                  <rect x="14" y="40" width="158" height="2" rx="1" fill="var(--color-ink-4)" opacity="0.5"/>
                  <rect x="14" y="46" width="140" height="2" rx="1" fill="var(--color-ink-4)" opacity="0.5"/>
                  <rect x="14" y="52" width="152" height="2" rx="1" fill="var(--color-ink-4)" opacity="0.5"/>
                  <rect x="14" y="58" width="98" height="2" rx="1" fill="var(--color-ink-4)" opacity="0.5"/>
                  {/* Code block */}
                  <rect x="14" y="68" width="158" height="40" rx="2" fill="var(--color-paper-2)" stroke="var(--color-rule)" stroke-width="0.5"/>
                  <text x="20" y="80" fill="#C88A4A" font-size="6" class="mono-text">const</text>
                  <text x="42" y="80" fill="var(--color-ink-2)" font-size="6" class="mono-text">policy = {'{'}</text>
                  <text x="26" y="89" fill="var(--color-ink-3)" font-size="6" class="mono-text">Effect: "Allow",</text>
                  <text x="26" y="98" fill="var(--color-ink-3)" font-size="6" class="mono-text">Action: "s3:Get*"</text>
                  <text x="20" y="107" fill="var(--color-ink-2)" font-size="6" class="mono-text">{'}'}</text>
                  {/* More paragraph */}
                  <rect x="14" y="118" width="158" height="2" rx="1" fill="var(--color-ink-4)" opacity="0.5"/>
                  <rect x="14" y="124" width="130" height="2" rx="1" fill="var(--color-ink-4)" opacity="0.5"/>
                  <rect x="14" y="130" width="145" height="2" rx="1" fill="var(--color-ink-4)" opacity="0.5"/>
                  {/* Image placeholder */}
                  <rect x="14" y="140" width="158" height="60" rx="2" fill="var(--color-paper-3)" stroke="var(--color-rule)" stroke-width="0.5"/>
                  <text x="93" y="174" fill="var(--color-ink-4)" font-size="7" text-anchor="middle" class="mono-text">diagram</text>
                  {/* More lines below fold */}
                  <rect x="14" y="210" width="158" height="2" rx="1" fill="var(--color-ink-4)" opacity="0.5"/>
                  <rect x="14" y="216" width="120" height="2" rx="1" fill="var(--color-ink-4)" opacity="0.5"/>
                </g>
              </g>
              {/* Scroll indicator */}
              <rect x="180" y="10" width="2" height="30" rx="1" fill="var(--color-rule)"/>
              <rect x="180" y="10" width="2" height="12" rx="1" fill="var(--color-ink-4)">
                <animate attributeName="y" values="10;28;28;10" keyTimes="0;0.4;0.8;1" dur="10s" repeatCount="indefinite"/>
              </rect>
            </g>

            {/* === STREAK CARD (bottom-right, floating) === */}
            <g transform="translate(340, 400)" style={{ animation: "hero-float-1 7s ease-in-out 1s infinite" }}>
              <rect width="155" height="52" rx="3" fill="var(--color-paper)" stroke="var(--color-rule)" stroke-width="1"/>
              <circle cx="28" cy="26" r="14" fill="var(--color-accent)"/>
              <text x="28" y="30" fill="var(--color-paper)" font-size="10" text-anchor="middle" font-weight="500">A</text>
              <text x="50" y="22" fill="var(--color-ink)" font-size="8.5" font-weight="500">12-day streak</text>
              <text x="50" y="34" fill="var(--color-ink-3)" font-size="6" class="mono-text">18 min to finish today</text>
              {/* Mini week dots */}
              {["M","T","W","T","F","S","S"].map((d, i) => (
                <g key={i} transform={`translate(${50 + i * 13}, 40)`}>
                  <rect width="9" height="9" rx="1.5" fill={i < 5 ? "var(--color-accent)" : "var(--color-paper-2)"} stroke="var(--color-rule)" stroke-width="0.5"/>
                </g>
              ))}
            </g>

            {/* === NEXT CHAPTER pill (animated slide-in) === */}
            <g transform="translate(310, 365)">
              <g style={{ animation: "hero-slide-up 6s ease-in-out infinite" }}>
                <rect width="110" height="28" rx="2" fill="var(--color-ink)"/>
                <text x="14" y="18" fill="var(--color-paper)" font-size="7" class="mono-text" letter-spacing="0.04em">next chapter →</text>
              </g>
            </g>

            {/* === TOC sidebar peek (left edge) === */}
            <g transform="translate(20, 150)" style={{ animation: "hero-float-2 9s ease-in-out infinite" }}>
              <rect width="120" height="220" rx="3" fill="var(--color-paper)" stroke="var(--color-rule)" stroke-width="1"/>
              <text x="12" y="18" fill="var(--color-ink-3)" font-size="5.5" letter-spacing="0.12em" class="mono-text">TABLE OF CONTENTS</text>
              <rect x="12" y="24" width="96" height="0.5" fill="var(--color-rule)"/>

              {/* Chapter items */}
              {[
                { n: "01", t: "Introduction", done: true },
                { n: "02", t: "Fundamentals", done: true },
                { n: "03", t: "Storage classes", done: true },
                { n: "04", t: "Uploading", done: true },
                { n: "05", t: "Versioning", done: true },
                { n: "06", t: "Notifications", done: true },
                { n: "07", t: "Web hosting", done: true },
                { n: "08", t: "Performance", done: true },
                { n: "09", t: "Costs", done: true },
                { n: "10", t: "Replication", done: true },
                { n: "11", t: "Security", done: false, current: true },
              ].map((ch, i) => (
                <g key={i} transform={`translate(0, ${32 + i * 17})`}>
                  {/* Current chapter highlight */}
                  {ch.current && (
                    <rect x="2" y="-3" width="116" height="15" rx="2" fill="var(--color-paper-2)">
                      <animate attributeName="opacity" values="0.5;1;0.5" dur="3s" repeatCount="indefinite"/>
                    </rect>
                  )}
                  {ch.current && <rect x="2" y="-3" width="2" height="15" fill="var(--color-accent)"/>}
                  {/* Check or number */}
                  {ch.done ? (
                    <g transform="translate(10, 0)">
                      <circle cx="4" cy="4" r="4" fill="none" stroke="var(--color-accent)" stroke-width="0.8" opacity="0.5"/>
                      <path d="M1.5 4 L3.5 6 L7 1.5" fill="none" stroke="var(--color-accent)" stroke-width="0.8" opacity="0.5"/>
                    </g>
                  ) : (
                    <text x="12" y="7" fill="var(--color-accent-ink)" font-size="5.5" class="mono-text" font-weight="500">{ch.n}</text>
                  )}
                  <text x="24" y="7" fill={ch.current ? "var(--color-ink)" : "var(--color-ink-3)"} font-size="6.5" font-weight={ch.current ? "500" : "400"}>
                    {ch.t}
                  </text>
                </g>
              ))}
            </g>

            {/* === Completion animation (floating checkmark) === */}
            <g transform="translate(145, 310)" style={{ animation: "hero-fade-loop 12s ease-in-out infinite" }}>
              <rect width="170" height="30" rx="15" fill="var(--color-paper)" stroke="var(--color-accent)" stroke-width="1"/>
              <circle cx="20" cy="15" r="8" fill="var(--color-accent)" opacity="0.15"/>
              <path d="M16 15 L19 18 L25 12" fill="none" stroke="var(--color-accent)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <text x="36" y="18" fill="var(--color-ink-2)" font-size="7" font-weight="500">Chapter 10 complete</text>
            </g>

            {/* === Reading cursor blink === */}
            <g transform="translate(324, 172)">
              <rect width="1.5" height="10" fill="var(--color-accent)" rx="0.5" style={{ animation: "hero-cursor 1.2s step-end infinite" }}/>
            </g>
          </svg>
        </div>
      </section>

      {/* Rule + label */}
      <div style={{ maxWidth: "1200px", margin: "60px auto 0", padding: "0 32px" }}>
        <div id="how-it-works" style={{ borderTop: "1px solid var(--color-rule)", paddingTop: "20px" }}>
          <span class="mono" style={{ fontSize: "10.5px", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-ink-3)" }}>
            How Learn is different
          </span>
        </div>
      </div>

      {/* Three principles */}
      <section style={{
        maxWidth: "1200px", margin: "0 auto", padding: "40px 32px 80px",
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "60px",
      }}>
        {[
          { n: "01", k: "One focus", h: "The dashboard shows one book, not sixty.", p: "We pick up where you left off and show exactly the next chapter. Everything else lives in the library, one click away." },
          { n: "02", k: "Chapter-sized sessions", h: "Every session fits in a coffee break.", p: "We break books into readable chapters with honest time estimates. No more 'in progress' forever — just finish the next one." },
          { n: "03", k: "Calm, not gamified", h: "A streak you can keep, not a grind.", p: "No neon XP, no confetti, no guilt. A gentle counter of days you showed up, and a weekly rhythm that respects your time." },
        ].map((card) => (
          <div key={card.n}>
            <div class="mono" style={{ fontSize: "11px", color: "var(--color-ink-3)", marginBottom: "16px", letterSpacing: "0.1em" }}>
              {card.n} &nbsp;·&nbsp; {card.k}
            </div>
            <h3 class="serif" style={{ fontSize: "28px", lineHeight: 1.1, margin: "0 0 12px", letterSpacing: "-0.01em", fontWeight: 400 }}>
              {card.h}
            </h3>
            <p style={{ fontSize: "14.5px", color: "var(--color-ink-2)", lineHeight: 1.55, margin: 0 }}>
              {card.p}
            </p>
          </div>
        ))}
      </section>

      {/* Sample session strip */}
      <section id="session" style={{ background: "var(--color-paper-2)", borderTop: "1px solid var(--color-rule)", borderBottom: "1px solid var(--color-rule)" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "70px 32px", display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "80px", alignItems: "center" }}>
          <div>
            <span class="mono" style={{ fontSize: "10.5px", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-ink-3)" }}>A typical session</span>
            <h2 class="serif" style={{ fontSize: "52px", margin: "16px 0", lineHeight: 1, letterSpacing: "-0.02em", fontWeight: 400 }}>
              22 minutes. <em style={{ color: "var(--color-accent-ink)" }}>One chapter.</em> Back to your day.
            </h2>
            <p style={{ fontSize: "15.5px", lineHeight: 1.55, color: "var(--color-ink-2)", maxWidth: "440px" }}>
              Open Learn, see the next chapter, read. We remember where you left off — to the page, to the paragraph.
              When the chapter ends, so does the session.
            </p>
          </div>

          {/* Session timeline */}
          <div style={{ background: "var(--color-paper)", border: "1px solid var(--color-rule)", borderRadius: "3px", padding: "24px" }}>
            {[
              { t: "09:42", w: "Open Learn", sub: "Next: AWS S3 ch. 11 · 18 min" },
              { t: "09:43", w: "Start chapter 11", sub: "Security, Access Control & Bucket Policies" },
              { t: "09:58", w: "Page 48 of 57", sub: "Autosaved. Last paragraph highlighted." },
              { t: "10:01", w: "Chapter complete", sub: "Streak +1 · 2 chapters left in book" },
              { t: "10:01", w: "Session ends", sub: "Back tomorrow?" },
            ].map((row, i) => (
              <div key={i} style={{
                display: "grid", gridTemplateColumns: "60px 14px 1fr",
                gap: "16px", alignItems: "flex-start",
                padding: "10px 0",
                borderBottom: i === 4 ? "none" : "1px dashed var(--color-rule-soft)",
              }}>
                <div class="mono" style={{ fontSize: "11px", color: "var(--color-ink-3)", paddingTop: "2px" }}>{row.t}</div>
                <div style={{ paddingTop: "6px" }}>
                  <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: i < 4 ? "var(--color-accent)" : "var(--color-ink-4)" }} />
                </div>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 500 }}>{row.w}</div>
                  <div style={{ fontSize: "12.5px", color: "var(--color-ink-3)" }}>{row.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA footer */}
      <section style={{ maxWidth: "1200px", margin: "0 auto", padding: "90px 32px", textAlign: "center" }}>
        <h2 class="serif" style={{ fontSize: "64px", margin: 0, lineHeight: 1, letterSpacing: "-0.02em", fontWeight: 400 }}>
          Your next chapter,<br/>
          <em style={{ color: "var(--color-accent-ink)" }}>waiting.</em>
        </h2>
        <div style={{ marginTop: "32px", display: "inline-flex", gap: "10px" }}>
          <Link href="/dashboard" class="ln-btn ln-btn-primary">
            Open your library
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer class="ln-footer">
        <div class="ln-footer-inner">
          <Link href="/" class="ln-brand" style={{ marginRight: "16px" }}>
            <span class="ln-brand-mark" style={{ width: "15px", height: "15px", fontSize: "12px" }}>L</span>
            <span class="ln-brand-label" style={{ fontSize: "13px" }}>Learn</span>
          </Link>
          <span>— a reading room for technical books.</span>
          <div style={{ flex: 1 }} />
          <div class="ln-footer-links">
            <Link href="/dashboard">Library</Link>
            <span>RSS</span>
            <span>GitHub</span>
          </div>
        </div>
      </footer>
    </div>
  );
});
