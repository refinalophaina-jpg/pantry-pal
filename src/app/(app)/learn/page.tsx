"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Clock, ChevronDown } from "lucide-react";
import { listTechniques, type Technique } from "@/lib/food-db";
import { Card, Input, Skeleton } from "@/components/ui";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";

/** Render a guide body: numbered steps, **bold** spans, and a sources line with live links. */
function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*|https?:\/\/[^\s;,]+)/g).map((part, j) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={j} className="font-medium text-[var(--text)]">{part.slice(2, -2)}</strong>
        ) : /^https?:\/\//.test(part) ? (
          <a key={j} href={part.replace(/[.;,]+$/, "")} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">{new URL(part.replace(/[.;,]+$/, "")).hostname}</a>
        ) : (
          part
        ),
      )}
    </>
  );
}

function GuideBody({ text }: { text: string }) {
  const lines = text.split("\n").filter(Boolean);
  const steps = lines.filter((line) => /^\d+[.)]\s/.test(line));
  const notes = lines.filter((line) => !/^\d+[.)]\s/.test(line) && !/^sources?:/i.test(line));
  const sources = lines.find((line) => /^sources?:/i.test(line));
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {steps.length > 0 && (
        <ol className="space-y-1.5">
          {steps.map((line, i) => (
            <li key={i} className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--bg)] text-xs font-medium tabular-nums text-[var(--text-muted)]">{i + 1}</span>
              <span><Inline text={line.replace(/^\d+[.)]\s*/, "")} /></span>
            </li>
          ))}
        </ol>
      )}
      {notes.map((line, i) => <p key={i} className="text-[var(--text-muted)]"><Inline text={line} /></p>)}
      {sources && <p className="text-xs text-[var(--text-faint)]"><Inline text={sources} /></p>}
    </div>
  );
}

/** The sources named in a guide, without their links, for the collapsed row. */
function sourceNames(body: string) {
  return body.split("\n").find((line) => /^sources?:/i.test(line))?.replace(/^sources?:\s*/i, "").replace(/https?:\/\/[^\s;,]+/g, "").replace(/\s+;/g, ";").replace(/\s{2,}/g, " ").replace(/\.$/, "").trim();
}

export default function LearnPage() {
  const [techniques, setTechniques] = useState<Technique[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [openIds, setOpenIds] = useState<Set<string> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const t = await listTechniques();
        if (!cancelled) setTechniques(t);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load guides.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // The first guide in each category starts open so the format is obvious; the rest are a tap away.
  const opened = useMemo(() => openIds ?? new Set(Array.from(new Map(techniques.map((t) => [t.category, t.id])).values())), [openIds, techniques]);
  function toggle(id: string) { setOpenIds(new Set(opened.has(id) ? [...opened].filter((item) => item !== id) : [...opened, id])); }

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? techniques.filter((t) => t.title.toLowerCase().includes(q) || t.summary.toLowerCase().includes(q) || t.category.toLowerCase().includes(q) || t.body.toLowerCase().includes(q) || t.tags.some((tag) => tag.toLowerCase().includes(q)))
      : techniques;
    const byCat = new Map<string, Technique[]>();
    for (const t of filtered) byCat.set(t.category, [...(byCat.get(t.category) ?? []), t]);
    return Array.from(byCat.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [techniques, query]);

  return (
    <div>
      <PageHeader
        title="Learn"
        subtitle="Short technique guides: the steps that matter, the temperature that keeps you safe, and where each one comes from."
      />

      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-faint)]" aria-hidden="true" />
        <Input aria-label="Search techniques" className="pl-9" placeholder="Search techniques, e.g. sear, roux, 165…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {loading && (
        <div className="max-w-3xl space-y-3" role="status" aria-label="Loading guides">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="space-y-3">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </Card>
          ))}
        </div>
      )}
      {error && !loading && <Card className="text-sm text-[var(--danger)]">{error}</Card>}
      {!loading && !error && groups.length === 0 && <p className="text-sm text-[var(--text-muted)]">No techniques match “{query}”.</p>}

      <div className="max-w-3xl space-y-10">
        {groups.map(([category, items]) => (
          <section key={category} aria-labelledby={`learn-${category.replace(/\W+/g, "-")}`}>
            <h2 id={`learn-${category.replace(/\W+/g, "-")}`} className="mb-3 text-base font-medium">{category}</h2>
            <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
              {items.map((t) => {
                const open = opened.has(t.id);
                const sources = sourceNames(t.body);
                return (
                  <li key={t.id} className="py-3">
                    <button type="button" aria-expanded={open} className="flex min-h-11 w-full cursor-pointer items-start justify-between gap-3 text-left" onClick={() => toggle(t.id)}>
                      <span className="min-w-0">
                        <span className="block font-medium leading-snug">{t.title}</span>
                        <span className="mt-0.5 block text-sm text-[var(--text-muted)]">{t.summary}</span>
                        <span className="mt-1 block text-xs text-[var(--text-faint)]">
                          <span className="capitalize">{t.difficulty}</span>
                          {t.minutes !== undefined && <> · <Clock className="inline size-3 align-[-1px]" aria-hidden="true" /> {t.minutes} min</>}
                          {sources && <> · {sources}</>}
                        </span>
                      </span>
                      <ChevronDown className={cn("mt-1 size-4 shrink-0 text-[var(--text-muted)] transition-transform", open && "rotate-180")} aria-hidden="true" />
                    </button>
                    {open && t.body && <div className="mt-3 sm:pl-2"><GuideBody text={t.body} /></div>}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
