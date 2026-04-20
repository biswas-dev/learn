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

        {/* Hero art — animated SVG showing a full app mockup */}
        <div style={{ position: "relative", height: "520px" }}>
          <svg class="hero-svg" viewBox="0 0 500 520" width="100%" height="100%" style={{ borderRadius: "3px", overflow: "hidden" }}>
            <defs>
              <pattern id="page-lines" x="0" y="0" width="4" height="3" patternUnits="userSpaceOnUse">
                <rect width="4" height="1" fill="#000" opacity="0.04"/>
              </pattern>
              <linearGradient id="spine-shadow" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stop-color="#000" stop-opacity="0.12"/>
                <stop offset="100%" stop-color="#000" stop-opacity="0"/>
              </linearGradient>
              <clipPath id="reader-clip"><rect x="1" y="1" width="498" height="518" rx="3"/></clipPath>
              <clipPath id="content-scroll"><rect x="152" y="62" width="347" height="458"/></clipPath>
            </defs>

            {/* App frame */}
            <rect width="500" height="520" rx="4" fill="var(--color-paper)" stroke="var(--color-rule)" stroke-width="1"/>

            {/* === TOP NAV BAR === */}
            <rect x="0" y="0" width="500" height="42" fill="var(--color-paper)" rx="4"/>
            <rect x="0" y="40" width="500" height="2" fill="var(--color-rule)"/>
            {/* Wordmark */}
            <rect x="16" y="12" width="16" height="16" rx="2" fill="var(--color-ink)"/>
            <text x="24" y="24" fill="var(--color-paper)" font-size="10" class="serif-text" font-style="italic" text-anchor="middle">L</text>
            <text x="38" y="25" fill="var(--color-ink)" font-size="10" font-weight="500">Learn</text>
            {/* Nav tabs */}
            <text x="90" y="25" fill="var(--color-ink-3)" font-size="8">Today</text>
            <text x="130" y="25" fill="var(--color-ink-3)" font-size="8">Library</text>
            <text x="175" y="25" fill="var(--color-ink)" font-size="8" font-weight="500">Reading</text>
            <rect x="170" y="38" width="35" height="2" fill="var(--color-ink)"/>
            {/* Search pill */}
            <rect x="310" y="11" width="130" height="20" rx="3" fill="none" stroke="var(--color-rule)" stroke-width="0.8"/>
            <text x="328" y="24" fill="var(--color-ink-4)" font-size="6.5">Search your library</text>
            {/* Avatar */}
            <circle cx="470" cy="21" r="10" fill="var(--color-accent)"/>
            <text x="470" y="25" fill="var(--color-paper)" font-size="8" text-anchor="middle" font-weight="500">A</text>

            {/* === LEFT SIDEBAR — TOC === */}
            <rect x="0" y="42" width="150" height="478" fill="var(--color-paper-2)"/>
            <rect x="150" y="42" width="1" height="478" fill="var(--color-rule)"/>

            {/* Book cover mini */}
            <g transform="translate(16, 56)" style={{ animation: "hero-float-1 8s ease-in-out infinite" }}>
              <rect width="50" height="68" rx="2" fill="#C88A4A"/>
              <rect width="50" height="68" fill="url(#page-lines)" opacity="0.5"/>
              <rect width="3" height="68" fill="url(#spine-shadow)"/>
              <text x="7" y="12" fill="rgba(255,255,255,0.6)" font-size="4" letter-spacing="0.1em" class="mono-text">LEARN</text>
              <text x="7" y="55" fill="rgba(255,255,255,0.9)" font-size="7" class="serif-text">
                <tspan x="7">AWS S3</tspan>
                <tspan x="7" dy="10">Guide</tspan>
              </text>
            </g>
            {/* Book info */}
            <text x="74" y="72" fill="var(--color-ink)" font-size="7.5" class="serif-text">AWS S3</text>
            <text x="74" y="83" fill="var(--color-ink-3)" font-size="5.5" class="mono-text">CH 11 OF 11</text>
            {/* Progress bar */}
            <rect x="74" y="90" width="65" height="2" rx="1" fill="var(--color-rule)"/>
            <rect x="74" y="90" width="65" height="2" rx="1" fill="var(--color-accent)">
              <animate attributeName="width" values="20;40;55;65;65;20" keyTimes="0;0.25;0.5;0.8;0.95;1" dur="14s" repeatCount="indefinite"/>
            </rect>
            <text x="74" y="102" fill="var(--color-ink-4)" font-size="5" class="mono-text">
              <tspan>91% complete</tspan>
            </text>

            {/* TOC divider */}
            <rect x="14" y="115" width="122" height="0.5" fill="var(--color-rule)"/>
            <text x="14" y="130" fill="var(--color-ink-3)" font-size="5" letter-spacing="0.12em" class="mono-text">TABLE OF CONTENTS</text>

            {/* Chapter items — dense list */}
            {[
              { t: "Introduction", done: true },
              { t: "S3 Fundamentals", done: true },
              { t: "Storage Classes", done: true },
              { t: "Uploading Objects", done: true },
              { t: "Versioning", done: true },
              { t: "Event Notifications", done: true },
              { t: "Static Hosting", done: true },
              { t: "Performance", done: true },
              { t: "Costs & Billing", done: true },
              { t: "Replication", done: true },
              { t: "Security & IAM", done: false, current: true },
            ].map((ch, i) => (
              <g key={i} transform={`translate(10, ${140 + i * 18})`}>
                {ch.current && <rect x="-2" y="-5" width="140" height="16" rx="2" fill="var(--color-paper)"/>}
                {ch.current && <rect x="-2" y="-5" width="2" height="16" rx="1" fill="var(--color-accent)"/>}
                {ch.done ? (
                  <g transform="translate(4, -1)">
                    <circle cx="4" cy="4" r="4" fill="none" stroke="var(--color-accent)" stroke-width="0.7" opacity="0.4"/>
                    <path d="M1.5 4 L3.5 6 L7 1.5" fill="none" stroke="var(--color-accent)" stroke-width="0.7" opacity="0.4"/>
                  </g>
                ) : (
                  <text x="6" y="6" fill="var(--color-accent-ink)" font-size="5" class="mono-text" font-weight="500">{String(i + 1).padStart(2, "0")}</text>
                )}
                <text x="18" y="6" fill={ch.current ? "var(--color-ink)" : "var(--color-ink-3)"} font-size="6.5" font-weight={ch.current ? "500" : "400"}>
                  {ch.t}
                </text>
              </g>
            ))}

            {/* Streak mini at bottom of sidebar */}
            <g transform="translate(14, 365)">
              <rect x="-4" y="-6" width="136" height="50" rx="3" fill="var(--color-paper)" stroke="var(--color-rule)" stroke-width="0.5"/>
              <circle cx="14" cy="14" r="10" fill="var(--color-accent)" opacity="0.15"/>
              <text x="14" y="18" fill="var(--color-accent)" font-size="9" text-anchor="middle" font-weight="600" class="serif-text">12</text>
              <text x="30" y="12" fill="var(--color-ink)" font-size="6" font-weight="500">12-day streak</text>
              <text x="30" y="22" fill="var(--color-ink-3)" font-size="5" class="mono-text">18 min left today</text>
              {/* Week dots */}
              {["M","T","W","T","F","S","S"].map((_, i) => (
                <rect key={i} x={4 + i * 17} y="30" width="12" height="8" rx="1.5"
                  fill={i < 5 ? "var(--color-accent)" : "var(--color-paper-2)"}
                  stroke="var(--color-rule)" stroke-width="0.4"
                  opacity={i < 5 ? 0.8 : 1}/>
              ))}
            </g>

            {/* === MAIN CONTENT — reading page === */}
            <g clip-path="url(#content-scroll)">
              <g>
                <animateTransform attributeName="transform" type="translate" values="0,0;0,-80;0,-80;0,0" keyTimes="0;0.35;0.75;1" dur="14s" repeatCount="indefinite"/>

                {/* Breadcrumb */}
                <text x="168" y="58" fill="var(--color-ink-4)" font-size="5" class="mono-text" letter-spacing="0.08em">LIBRARY / AWS S3 / SECURITY &amp; IAM</text>

                {/* Page title */}
                <text x="168" y="85" fill="var(--color-ink)" font-size="16" font-weight="600">Security & IAM Policies</text>

                {/* Summary block */}
                <rect x="168" y="95" width="3" height="24" fill="var(--color-accent)" rx="1"/>
                <text x="178" y="106" fill="var(--color-ink-2)" font-size="7" font-style="italic">Learn how to secure your S3 buckets with</text>
                <text x="178" y="115" fill="var(--color-ink-2)" font-size="7" font-style="italic">IAM policies, bucket policies, and ACLs.</text>

                {/* Heading */}
                <text x="168" y="145" fill="var(--color-ink)" font-size="11" font-weight="600">Understanding IAM Policies</text>
                <rect x="168" y="150" width="300" height="0.5" fill="var(--color-rule-soft)"/>

                {/* Paragraph lines */}
                {[0,7,14,21,28].map((dy, i) => (
                  <rect key={i} x="168" y={160 + dy} width={[310,290,305,270,180][i]} height="2.5" rx="1" fill="var(--color-ink-4)" opacity="0.35"/>
                ))}

                {/* Code block */}
                <rect x="168" y="200" width="310" height="70" rx="3" fill="var(--color-paper-2)" stroke="var(--color-rule)" stroke-width="0.5"/>
                <text x="178" y="216" fill="#C88A4A" font-size="7" class="mono-text">const</text>
                <text x="204" y="216" fill="var(--color-ink-2)" font-size="7" class="mono-text">s3Policy = {'{'}</text>
                <text x="190" y="228" fill="var(--color-ink-3)" font-size="7" class="mono-text">Version: "2012-10-17",</text>
                <text x="190" y="240" fill="var(--color-ink-3)" font-size="7" class="mono-text">Statement: [{'{'}</text>
                <text x="202" y="252" fill="#5E6E58" font-size="7" class="mono-text">Effect: "Allow",</text>
                <text x="202" y="264" fill="#5E6E58" font-size="7" class="mono-text">Action: "s3:GetObject"</text>
                <text x="190" y="276" fill="var(--color-ink-3)" font-size="7" class="mono-text">{'}'}]</text>
                <text x="178" y="288" fill="var(--color-ink-2)" font-size="7" class="mono-text">{'}'}</text>

                {/* Cursor blink */}
                <rect x="244" y="256" width="1.5" height="10" rx="0.5" fill="var(--color-accent)" style={{ animation: "hero-cursor 1.2s step-end infinite" }}/>

                {/* Image / diagram */}
                <rect x="168" y="305" width="310" height="100" rx="3" fill="var(--color-paper-3)" stroke="var(--color-rule)" stroke-width="0.5"/>
                {/* Diagram content */}
                <rect x="200" y="330" width="60" height="24" rx="2" fill="var(--color-accent)" opacity="0.15" stroke="var(--color-accent)" stroke-width="0.5"/>
                <text x="230" y="345" fill="var(--color-accent-ink)" font-size="6" text-anchor="middle" font-weight="500">IAM User</text>
                <line x1="260" y1="342" x2="300" y2="342" stroke="var(--color-ink-4)" stroke-width="0.8" stroke-dasharray="3,2"/>
                <text x="280" y="338" fill="var(--color-ink-4)" font-size="4.5" text-anchor="middle" class="mono-text">assume</text>
                <rect x="300" y="330" width="60" height="24" rx="2" fill="#C88A4A" opacity="0.15" stroke="#C88A4A" stroke-width="0.5"/>
                <text x="330" y="345" fill="#8A6B4A" font-size="6" text-anchor="middle" font-weight="500">IAM Role</text>
                <line x1="360" y1="342" x2="400" y2="342" stroke="var(--color-ink-4)" stroke-width="0.8" stroke-dasharray="3,2"/>
                <text x="380" y="338" fill="var(--color-ink-4)" font-size="4.5" text-anchor="middle" class="mono-text">access</text>
                <rect x="400" y="330" width="55" height="24" rx="2" fill="#5E6E58" opacity="0.15" stroke="#5E6E58" stroke-width="0.5"/>
                <text x="427" y="345" fill="#4A5E42" font-size="6" text-anchor="middle" font-weight="500">S3</text>
                <text x="315" y="390" fill="var(--color-ink-4)" font-size="5.5" text-anchor="middle" font-style="italic">IAM authentication flow for S3 access</text>

                {/* More text after image */}
                <text x="168" y="425" fill="var(--color-ink)" font-size="11" font-weight="600">Bucket Policies</text>
                {[0,7,14,21].map((dy, i) => (
                  <rect key={`b${i}`} x="168" y={435 + dy} width={[310,280,300,200][i]} height="2.5" rx="1" fill="var(--color-ink-4)" opacity="0.35"/>
                ))}

                {/* Another code block */}
                <rect x="168" y="470" width="310" height="50" rx="3" fill="var(--color-paper-2)" stroke="var(--color-rule)" stroke-width="0.5"/>
                <text x="178" y="486" fill="#C88A4A" font-size="7" class="mono-text">aws</text>
                <text x="196" y="486" fill="var(--color-ink-2)" font-size="7" class="mono-text">s3api put-bucket-policy \</text>
                <text x="190" y="498" fill="var(--color-ink-3)" font-size="7" class="mono-text">--bucket my-secure-bucket \</text>
                <text x="190" y="510" fill="var(--color-ink-3)" font-size="7" class="mono-text">--policy file://policy.json</text>
              </g>
            </g>

            {/* Scrollbar */}
            <rect x="493" y="50" width="3" height="460" rx="1.5" fill="var(--color-rule)" opacity="0.5"/>
            <rect x="493" y="50" width="3" height="80" rx="1.5" fill="var(--color-ink-4)" opacity="0.4">
              <animate attributeName="y" values="50;130;130;50" keyTimes="0;0.35;0.75;1" dur="14s" repeatCount="indefinite"/>
            </rect>

            {/* === COMPLETION TOAST (pops up mid-read) === */}
            <g transform="translate(230, 480)" style={{ animation: "hero-fade-loop 14s ease-in-out 5s infinite" }}>
              <rect width="180" height="28" rx="14" fill="var(--color-paper)" stroke="var(--color-accent)" stroke-width="0.8" filter="drop-shadow(0 2px 8px rgba(0,0,0,0.08))"/>
              <circle cx="18" cy="14" r="7" fill="var(--color-accent)" opacity="0.15"/>
              <path d="M14 14 L17 17 L22 11" fill="none" stroke="var(--color-accent)" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
              <text x="32" y="17" fill="var(--color-ink-2)" font-size="7" font-weight="500">Chapter 10 complete!</text>
            </g>

            {/* === PAGE NAV at bottom === */}
            <rect x="152" y="500" width="347" height="20" fill="var(--color-paper-2)"/>
            <rect x="152" y="500" width="347" height="0.5" fill="var(--color-rule)"/>
            <text x="168" y="514" fill="var(--color-ink-3)" font-size="5.5" class="mono-text">← Replication</text>
            <text x="482" y="514" fill="var(--color-ink-3)" font-size="5.5" class="mono-text" text-anchor="end">Finish →</text>
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
