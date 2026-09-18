/** An independent demonstration page: a pretend news site with the widget on it. */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

const title = "Naledi widget demonstration";
const description =
  "See the Naledi assistant running as a compact chat bubble on an ordinary website, with voice, chat and a full-screen view.";

export const Route = createFileRoute("/widget-demo")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WidgetDemoPage,
});

function WidgetDemoPage() {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "/widget.js";
    script.async = true;
    script.setAttribute("data-statbridge", "");
    script.setAttribute("data-origin", window.location.origin);
    document.body.appendChild(script);
    return () => {
      script.remove();
      document.querySelector("[data-statbridge-root]")?.remove();
      delete (window as unknown as Record<string, unknown>)["__statbridgeWidget"];
    };
  }, []);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-hairline">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4">
          <p className="font-display text-lg font-bold tracking-tight">The Daily Ledger</p>
          <nav className="hidden gap-5 text-sm text-muted-foreground sm:flex">
            <span>Business</span>
            <span>Economy</span>
            <span>Opinion</span>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-12">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">Demonstration page</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
          This is somebody else's website — with Naledi on it.
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Look at the bottom {""}
          <span className="font-semibold text-foreground">right</span> corner. The bubble opens a compact assistant panel,
          the same size as a live-chat window. Inside it you can talk or type, make the panel full screen, or open the
          full Naledi site in a new tab.
        </p>

        <section className="mt-10 rounded-2xl border border-hairline bg-surface/60 p-6">
          <h2 className="font-display text-lg font-semibold">Add it to your own site</h2>
          <p className="mt-2 text-sm text-muted-foreground">One line, before the closing body tag.</p>
          <pre className="mt-4 overflow-x-auto rounded-xl border border-hairline bg-background p-4 text-xs leading-relaxed">
{`<script
  src="${typeof window === "undefined" ? "https://your-naledi-site" : window.location.origin}/widget.js"
  data-statbridge
  data-position="right"
  async
></script>`}
          </pre>
          <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
            <li>· <span className="text-foreground">data-position</span> — put the bubble on the left or the right.</li>
            <li>· <span className="text-foreground">data-label</span> — change the wording shown on hover.</li>
            <li>· <span className="text-foreground">Naledi.open()</span> — open the panel from your own button.</li>
          </ul>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            ["Compact by default", "A 400 by 620 panel, exactly like a live-chat window, that never covers the page."],
            ["Full screen on request", "One tap makes it large for long answers, tables and charts."],
            ["Voice or typing", "The same checked answers, spoken or written, on phones and desktops."],
          ].map(([heading, body]) => (
            <article key={heading} className="rounded-xl border border-hairline bg-surface/40 p-4">
              <h3 className="text-sm font-semibold">{heading}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
            </article>
          ))}
        </section>

        <p className="mt-10 text-xs text-muted-foreground">
          Demonstration build. Every answer quotes approved South African publications, and media or sensitive requests
          always go to a person.
        </p>
      </main>
    </div>
  );
}
