/** Shared search and page controls for the staff's record collections. */
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

export const collectionSelectClass =
  "min-h-9 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function CollectionToolbar({
  search,
  onSearch,
  placeholder = "Search records…",
  searchLabel = "Search records",
  children,
  onReset,
}: {
  search: string;
  onSearch: (value: string) => void;
  placeholder?: string;
  searchLabel?: string;
  children?: ReactNode;
  onReset?: () => void;
}) {
  const [draft, setDraft] = useState(search);
  const id = useId();
  useEffect(() => setDraft(search), [search]);

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-3 sm:p-4">
      <form
        role="search"
        aria-label={searchLabel}
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          onSearch(draft.trim());
        }}
      >
        <label htmlFor={id} className="sr-only">
          {searchLabel}
        </label>
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            id={id}
            type="search"
            value={draft}
            maxLength={200}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={placeholder}
            className="min-h-9 w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>
      {(children || onReset) && (
        <div className="flex flex-wrap items-end gap-3">
          {children}
          {onReset && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setDraft("");
                onReset();
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function CollectionPagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  label = "Records",
  pageSizes = [10, 25, 50],
  busy = false,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  label?: string;
  pageSizes?: readonly number[];
  busy?: boolean;
}) {
  const count = Math.max(0, total);
  const pages = Math.max(1, Math.ceil(count / pageSize));
  const current = Math.min(Math.max(1, page), pages);
  const start = count ? (current - 1) * pageSize + 1 : 0;
  const end = Math.min(current * pageSize, count);
  const sizes = [...new Set([...pageSizes, pageSize])].sort((a, b) => a - b);

  return (
    <nav
      aria-label={`${label} pagination`}
      className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-xs"
    >
      <p aria-live="polite" className="text-muted-foreground">
        <span className="font-medium text-foreground">
          {start.toLocaleString()}–{end.toLocaleString()}
        </span>{" "}
        of {count.toLocaleString()} · Page {current} of {pages.toLocaleString()}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-muted-foreground">
          Per page
          <select
            aria-label={`${label} per page`}
            className={collectionSelectClass}
            value={pageSize}
            disabled={busy}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {sizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={`First ${label.toLowerCase()} page`}
            disabled={busy || current === 1}
            onClick={() => onPageChange(1)}
          >
            <ChevronFirst aria-hidden />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={`Previous ${label.toLowerCase()} page`}
            disabled={busy || current === 1}
            onClick={() => onPageChange(current - 1)}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={`Next ${label.toLowerCase()} page`}
            disabled={busy || current >= pages}
            onClick={() => onPageChange(current + 1)}
          >
            <ChevronRight aria-hidden />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={`Last ${label.toLowerCase()} page`}
            disabled={busy || current >= pages}
            onClick={() => onPageChange(pages)}
          >
            <ChevronLast aria-hidden />
          </Button>
        </div>
      </div>
    </nav>
  );
}
