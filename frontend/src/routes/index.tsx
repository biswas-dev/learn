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

const BookCoverLg = component$<{ color: string; title: string }>(({ color, title }) => (
  <div class="ln-cover ln-cover-lg" style={{ background: color }}>
    <div class="ln-cover-texture" />
    <div class="ln-cover-text">
      <div class="learn-label">Learn</div>
      <div style={{ textWrap: "pretty" }}>{title}</div>
    </div>
  </div>
));

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

        {/* Hero art */}
        <div style={{ position: "relative", height: "520px" }}>
          <div style={{
            position: "absolute", inset: 0,
            background: "var(--color-paper-2)", borderRadius: "3px",
            overflow: "hidden", border: "1px solid var(--color-rule)",
          }}>
            {/* faint grid */}
            <div style={{
              position: "absolute", inset: 0,
              backgroundImage: "linear-gradient(var(--color-rule-soft) 1px, transparent 1px), linear-gradient(90deg, var(--color-rule-soft) 1px, transparent 1px)",
              backgroundSize: "32px 32px", opacity: 0.5,
            }}/>

            {/* book composition */}
            <div style={{
              position: "absolute", left: "50%", top: "50%",
              transform: "translate(-50%, -50%)",
              display: "flex", gap: "3px",
            }}>
              <BookCoverLg color="#C88A4A" title="A Programmer's Guide to AWS S3" />
              <div style={{ width: "4px", background: "var(--color-ink-4)", opacity: 0.2 }} />
              <BookCoverLg color="#7A8B6A" title="A Hands-on Guide to Angular" />
            </div>

            {/* floating annotations */}
            <div style={{
              position: "absolute", top: "24px", left: "24px",
              padding: "10px 14px", background: "var(--color-paper)",
              border: "1px solid var(--color-rule)", borderRadius: "3px",
              fontSize: "11.5px", maxWidth: "200px",
            }}>
              <div class="mono" style={{ fontSize: "9.5px", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: "4px" }}>Now reading</div>
              <div class="serif" style={{ fontSize: "15px", lineHeight: 1.2 }}>Chapter 11 — Security, Access Control & Bucket Policies</div>
              <div style={{ marginTop: "8px" }}>
                <div class="ln-track"><div style={{ width: "32%" }} /></div>
              </div>
            </div>

            <div style={{
              position: "absolute", bottom: "24px", right: "24px",
              padding: "10px 14px", background: "var(--color-paper)",
              border: "1px solid var(--color-rule)", borderRadius: "3px",
              fontSize: "11.5px", display: "flex", alignItems: "center", gap: "10px",
            }}>
              <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "var(--color-accent)", color: "var(--color-paper)", display: "grid", placeItems: "center", fontSize: "11px", fontWeight: 500 }}>A</div>
              <div>
                <div style={{ fontWeight: 500 }}>12-day streak</div>
                <div class="mono" style={{ fontSize: "10px", color: "var(--color-ink-3)" }}>18 min to finish today</div>
              </div>
            </div>

            <div style={{
              position: "absolute", top: "40%", right: "32px",
              padding: "8px 12px", background: "var(--color-ink)", color: "var(--color-paper)",
              borderRadius: "2px", fontSize: "11px", fontFamily: "var(--font-mono)",
              letterSpacing: "0.04em",
            }}>next chapter →</div>
          </div>
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
