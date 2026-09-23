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
      {text.split(/(\*\*[^*]+\*\*|https?:\/\/\S+)/g).map((part, j) =>
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

export default function LearnPage() {
  const [techniques, setTechniques] = useState<Technique[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const t = await listTechniques();
        if (!cancelled) setTechniques(t);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load guides.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? techniques.filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            t.summary.toLowerCase().includes(q) ||
            t.category.toLowerCase().includes(q) ||
            t.tags.some((tag) => tag.toLowerCase().includes(q)),
        )
      : techniques;
    const byCat = new Map<string, Technique[]>();
    for (const t of filtered) {
      const list = byCat.get(t.category) ?? [];
      list.push(t);
      byCat.set(t.category, list);
    }
    return Array.from(byCat.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [techniques, query]);

  return (
    <div>
      <PageHeader
        title="Learn"
        subtitle="Short technique guides: the steps that matter, the temperature that keeps you safe, and where each one comes from."
      />

      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--text-faint)]" aria-hidden="true" />
        <Input
          aria-label="Search techniques"
          className="pl-9"
          placeholder="Search techniques…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loading && (
        <div
          className="grid gap-3 sm:grid-cols-2"
          role="status"
          aria-label="Loading guides"
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="space-y-3">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </Card>
          ))}
        </div>
      )}
      {error && !loading && (
        <Card className="text-sm text-[var(--danger)]">{error}</Card>
      )}

      {!loading && !error && groups.length === 0 && (
        <p className="text-sm text-[var(--text-muted)]">
          No techniques match “{query}”.
        </p>
      )}

      <div className="space-y-8">
        {groups.map(([category, items]) => (
          <section key={category}>
            <h2 className="mb-3 text-base font-medium">
              {category}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {items.map((t) => {
                const open = openId === t.id;
                return (
                  <Card
                    key={t.id}
                    className="cursor-pointer transition-colors hover:border-[var(--terracotta-q)]"

                  >
                    <button type="button" aria-expanded={open} className="w-full text-left min-h-11 flex items-start justify-between gap-3" onClick={() => setOpenId(open ? null : t.id)}>
                      <h3 className="font-medium">{t.title}</h3>
                      <ChevronDown
                        className={cn(
                          "size-4 text-[var(--text-muted)] transition-transform shrink-0",
                          open && "rotate-180",
                        )}
                      />
                    </button>
                    <p className="text-sm text-[var(--text-muted)] mt-1.5">
                      {t.summary}
                    </p>
                    <div className="mt-3 flex items-center gap-3 text-xs text-[var(--text-muted)]">
                      <span className="capitalize">{t.difficulty}</span>
                      {t.minutes !== undefined && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="size-3" aria-hidden="true" /> {t.minutes} min
                        </span>
                      )}
                    </div>
                    {open && t.body && (
                      <div className="mt-4 pt-4 border-t border-[var(--border)]">
                        <GuideBody text={t.body} />
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
