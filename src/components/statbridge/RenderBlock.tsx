/**
 * Renders one block of the public answer contract.
 *
 * Only the known block types below are drawn. An unknown type renders a
 * quiet notice instead of failing, so an older browser build can never crash
 * on a newer server response.
 */
import {
  AlertTriangle,
  Download,
  ExternalLink,
  FileText,
  ImageIcon,
  PlayCircle,
  Quote,
  Sheet,
  ShieldCheck,
  TableIcon,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { PublicRenderBlock, PublicSourceReference } from "@/lib/statbridge/contract";
import { KNOWN_BLOCK_TYPES } from "@/lib/statbridge/contract";

export function SourceLine({ source }: { source: PublicSourceReference }) {
  const bits = [
    source.publisher,
    source.publishedOn ? new Date(source.publishedOn).toLocaleDateString("en-ZA", { dateStyle: "medium" }) : null,
    source.pageNumber ? `page ${source.pageNumber}` : null,
    source.sectionLabel,
    source.versionLabel,
  ].filter(Boolean);

  return (
    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
      <span className="font-medium text-foreground">{source.title}</span>
      {bits.length > 0 && <> — {bits.join(" · ")}</>}
      {source.url && (
        <>
          {" "}
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium text-accent underline underline-offset-2"
          >
            Open source
            <ExternalLink aria-hidden className="size-3" />
          </a>
        </>
      )}
    </p>
  );
}

function Panel({
  children,
  tone = "official",
  label,
  icon,
}: {
  children: React.ReactNode;
  tone?: "official" | "warn" | "plain";
  label?: string;
  icon?: React.ReactNode;
}) {
  const toneClass =
    tone === "warn"
      ? "border-warn/40 bg-warn-surface"
      : tone === "plain"
        ? "border-border bg-surface"
        : "border-official/25 bg-official-surface";

  return (
    <section className={`rounded-lg border p-4 ${toneClass}`}>
      {label && (
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-official-foreground">
          {icon}
          {label}
        </p>
      )}
      {children}
    </section>
  );
}

function AccessibleTable({ columns, rows }: { columns: string[]; rows: Array<Record<string, string>> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border/70 text-left">
            {columns.map((c) => (
              <th key={c} scope="col" className="py-2 pr-4 font-semibold text-foreground">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border/40 last:border-0">
              {columns.map((c) => (
                <td key={c} className="py-2 pr-4 align-top text-muted-foreground">
                  {row[c] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Builds the download in the browser from the verified rows already shown. */
function downloadCsv(fileName: string, columns: string[], rows: Array<Record<string, string>>) {
  const escape = (value: string) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = [
    columns.map(escape).join(","),
    ...rows.map((row) => columns.map((column) => escape(row[column] ?? "")).join(",")),
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function RenderBlock({ block }: { block: PublicRenderBlock }) {
  if (!KNOWN_BLOCK_TYPES.includes(block.type)) {
    return (
      <Panel tone="plain">
        <p className="text-sm text-muted-foreground">
          This answer includes a piece of evidence this version of StatBridge cannot display yet.
        </p>
      </Panel>
    );
  }

  switch (block.type) {
    case "metric":
      return (
        <Panel label="Verified figure" icon={<ShieldCheck aria-hidden className="size-3.5" />}>
          <p className="text-sm font-medium text-foreground">{block.label}</p>
          <p className="mt-1 font-serif text-4xl font-semibold tabular-nums text-official-foreground">
            {block.displayValue}
            <span className="ml-1.5 text-base font-normal text-muted-foreground">{block.unit}</span>
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-3">
            <div>
              <dt className="font-medium text-foreground">Geography</dt>
              <dd>{block.geography}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Period</dt>
              <dd>{block.referencePeriod}</dd>
            </div>
            {block.population && (
              <div>
                <dt className="font-medium text-foreground">Population</dt>
                <dd>{block.population}</dd>
              </div>
            )}
            {block.adjustment && (
              <div>
                <dt className="font-medium text-foreground">Adjustment</dt>
                <dd>{block.adjustment}</dd>
              </div>
            )}
            {block.reportedChange && (
              <div>
                <dt className="font-medium text-foreground">Reported change</dt>
                <dd>{block.reportedChange}</dd>
              </div>
            )}
            {block.valueState !== "reported" && (
              <div>
                <dt className="font-medium text-foreground">Value state</dt>
                <dd>{block.valueState.replace("_", " ")}</dd>
              </div>
            )}
          </dl>
          <SourceLine source={block.source} />
        </Panel>
      );

    case "official_quote":
      return (
        <Panel label="Official wording" icon={<Quote aria-hidden className="size-3.5" />}>
          <blockquote className="border-l-2 border-official/40 pl-3 font-serif text-[15px] leading-relaxed text-foreground">
            {block.text}
          </blockquote>
          <SourceLine source={block.source} />
        </Panel>
      );

    case "definition":
      return (
        <Panel label="Definition" icon={<FileText aria-hidden className="size-3.5" />}>
          <p className="text-sm font-semibold text-foreground">{block.term}</p>
          <p className="mt-1 font-serif text-[15px] leading-relaxed text-foreground">{block.officialText}</p>
          <SourceLine source={block.source} />
        </Panel>
      );

    case "comparison_table":
      return (
        <Panel label="Comparison" icon={<TableIcon aria-hidden className="size-3.5" />}>
          <p className="mb-2 text-sm font-medium text-foreground">{block.title}</p>
          <AccessibleTable columns={block.columns} rows={block.rows} />
        </Panel>
      );

    case "chart": {
      const series = block.series[0];
      if (!series) return null;
      const data = series.points.map((p) => ({ label: p.label, value: p.value, displayValue: p.displayValue }));
      const Chart = block.chartType === "bar" ? BarChart : LineChart;
      return (
        <Panel label="Verified figures over time" icon={<ShieldCheck aria-hidden className="size-3.5" />}>
          <p className="mb-3 text-sm font-medium text-foreground">
            {block.title} <span className="font-normal text-muted-foreground">({series.unit})</span>
          </p>
          <div className="h-56 w-full" role="img" aria-label={`${block.title}. The same figures are in the table below.`}>
            <ResponsiveContainer width="100%" height="100%">
              <Chart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                <Tooltip
                  formatter={(_v, _n, item) => (item?.payload as { displayValue?: string })?.displayValue ?? ""}
                  contentStyle={{
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                {block.chartType === "bar" ? (
                  <Bar dataKey="value" fill="var(--color-chart-1)" radius={[3, 3, 0, 0]} />
                ) : (
                  <Line type="monotone" dataKey="value" stroke="var(--color-chart-1)" strokeWidth={2} dot />
                )}
              </Chart>
            </ResponsiveContainer>
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-medium text-accent">Show the same figures as a table</summary>
            <div className="mt-2">
              <AccessibleTable columns={block.table.columns} rows={block.table.rows} />
            </div>
          </details>
          <div className="mt-2 space-y-1">
            {block.sources.slice(0, 2).map((s) => (
              <SourceLine key={`${s.sourceVersionId}-${s.sectionLabel}`} source={s} />
            ))}
          </div>
        </Panel>
      );
    }

    case "document":
      return (
        <Panel tone="plain" label="Publication" icon={<FileText aria-hidden className="size-3.5" />}>
          <p className="text-sm font-semibold text-foreground">{block.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {[block.publisher, block.referencePeriod, block.publishedOn].filter(Boolean).join(" · ")}
          </p>
          {block.excerpt && <p className="mt-2 text-sm text-muted-foreground">{block.excerpt}</p>}
          {block.url && (
            <a
              href={block.url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent underline underline-offset-2"
            >
              Open the publication
              <ExternalLink aria-hidden className="size-3" />
            </a>
          )}
        </Panel>
      );

    case "caveat":
      return (
        <Panel tone="warn" label="Read with care" icon={<AlertTriangle aria-hidden className="size-3.5" />}>
          <p className="text-sm text-warn-foreground">{block.text}</p>
          {block.source && <SourceLine source={block.source} />}
        </Panel>
      );

    case "gap":
      return (
        <Panel tone="warn" label="Not covered">
          <p className="text-sm text-warn-foreground">{block.text}</p>
          {block.suggestion && <p className="mt-2 text-sm text-muted-foreground">{block.suggestion}</p>}
        </Panel>
      );

    case "case_acknowledgement":
      return (
        <Panel tone="warn" label="Sent to an official">
          <p className="text-sm text-warn-foreground">{block.message}</p>
          <p className="mt-3 font-mono text-lg font-semibold text-foreground">{block.reference}</p>
        </Panel>
      );

    case "image":
      return (
        <Panel tone="plain" label="Published figure" icon={<ImageIcon aria-hidden className="size-3.5" />}>
          <p className="text-sm font-semibold text-foreground">{block.title}</p>
          <img
            src={block.url}
            alt={block.alternativeText}
            loading="lazy"
            className="mt-2 max-h-80 w-full rounded-md border border-border object-contain"
            onError={(event) => {
              const image = event.currentTarget;
              image.style.display = "none";
              image.insertAdjacentHTML(
                "afterend",
                '<p class="mt-2 text-sm text-muted-foreground">This image could not be loaded. Use the source link below to open it at the publisher.</p>',
              );
            }}
          />
          {block.caption && <p className="mt-2 text-sm text-muted-foreground">{block.caption}</p>}
          <SourceLine source={block.source} />
        </Panel>
      );

    case "video":
      return (
        <Panel tone="plain" label="Published recording" icon={<PlayCircle aria-hidden className="size-3.5" />}>
          <p className="text-sm font-semibold text-foreground">{block.title}</p>
          {block.playback === "file" ? (
            <video
              controls
              preload="metadata"
              src={block.url}
              className="mt-2 w-full rounded-md border border-border"
              aria-label={block.title}
            >
              Your browser cannot play this recording.
            </video>
          ) : (
            <a
              href={block.url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-accent underline underline-offset-2"
            >
              Watch at the publisher
              <ExternalLink aria-hidden className="size-3" />
            </a>
          )}
          {block.caption && <p className="mt-2 text-sm text-muted-foreground">{block.caption}</p>}
          <SourceLine source={block.source} />
        </Panel>
      );

    case "dataset":
      return (
        <Panel label="Data you can download" icon={<Sheet aria-hidden className="size-3.5" />}>
          <p className="text-sm font-medium text-foreground">{block.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {block.rowCount} verified {block.rowCount === 1 ? "row" : "rows"} — opens in Excel, Numbers or any
            spreadsheet.
          </p>
          <div className="mt-3">
            <AccessibleTable columns={block.columns} rows={block.rows.slice(0, 8)} />
          </div>
          <button
            type="button"
            onClick={() => downloadCsv(block.fileName, block.columns, block.rows)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:border-accent hover:text-accent"
          >
            <Download aria-hidden className="size-3.5" />
            Download CSV
          </button>
          <div className="mt-2 space-y-1">
            {block.sources.slice(0, 2).map((s) => (
              <SourceLine key={`${s.sourceVersionId}-${s.sectionLabel}`} source={s} />
            ))}
          </div>
        </Panel>
      );

    case "clarification":
    case "follow_up_actions":
      return null;

    default:
      return null;
  }
}
