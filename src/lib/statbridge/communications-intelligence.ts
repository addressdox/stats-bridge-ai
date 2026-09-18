/** Observed demand only; these suggestions do not pretend to forecast events. */
export type TopicDemand = {
  topic: string;
  total: number;
  answered: number;
  gaps: number;
  escalated: number;
};
export function communicationSuggestions(topics: TopicDemand[], windowLabel: string): string[] {
  return [...topics]
    .filter((t) => t.topic !== "Not classified" && t.topic.trim())
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)
    .flatMap((t) => {
      if (t.gaps >= 3)
        return [
          `Prepare an evidence briefing on ${t.topic}: ${t.gaps} of ${t.total} questions in ${windowLabel} had no supported answer. Resolve the source gaps before drafting public wording.`,
        ];
      if (t.total >= 5)
        return [
          `Consider a reviewed FAQ or press release on ${t.topic}: ${t.total} questions were recorded in ${windowLabel}, including ${t.answered} supported answers and ${t.escalated} escalations. Use approved source material and the review workflow.`,
        ];
      return [];
    });
}
