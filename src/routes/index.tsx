import { createFileRoute } from "@tanstack/react-router";

import { AskExperience } from "@/components/statbridge/AskExperience";
import { SiteFooter, SiteHeader } from "@/components/statbridge/SiteChrome";

const title = "StatBridge — Ask about South Africa's official statistics";
const description =
  "Ask questions about published Statistics South Africa figures, definitions and publications. Every answer quotes approved sources; media and sensitive requests go to a communications official.";

export const Route = createFileRoute("/")({
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
  component: AskPage,
});

function AskPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-12">
        <AskExperience />
      </main>
      <SiteFooter />
    </div>
  );
}
