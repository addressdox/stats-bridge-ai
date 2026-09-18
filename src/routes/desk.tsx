import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { SiteFooter, SiteHeader } from "@/components/statbridge/SiteChrome";

const title = "StatBridge services — media, cases and developer tools";
const description = "Open the StatBridge Media Desk, track a private case, explore developer tools or sign in as staff.";

export const Route = createFileRoute("/desk")({
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
  component: DeskPage,
});

const DESTINATIONS = [
  { to: "/media", title: "Media Desk", description: "Send a deadline-aware request to a communications official." },
  { to: "/case", title: "Track a request", description: "Use your case reference and private token to see its status." },
  { to: "/developers", title: "Developers", description: "Explore the public API and embeddable assistant." },
  { to: "/staff/sign-in", title: "Staff sign in", description: "Review cases and manage approved knowledge." },
] as const;

function DeskPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto min-h-[calc(100svh-4rem)] max-w-5xl px-5 py-16 sm:py-24">
        <p className="eyebrow text-official">Public services</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold sm:text-6xl">Enter StatBridge</h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
          Media enquiries, private case tracking, public integration tools and the secure staff workspace.
        </p>
        <div className="mt-12 grid gap-px overflow-hidden rounded-lg border border-hairline bg-hairline sm:grid-cols-2">
          {DESTINATIONS.map((item) => (
            <Link key={item.to} to={item.to} className="group bg-background p-7 transition-colors hover:bg-surface focus-visible:z-10">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">{item.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
                </div>
                <ArrowRight aria-hidden className="mt-1 size-5 shrink-0 text-official transition-transform duration-300 group-hover:translate-x-1" />
              </div>
            </Link>
          ))}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}