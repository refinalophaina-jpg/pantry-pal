"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, ChefHat, Clock, ChevronDown } from "lucide-react";
import { listTechniques, type Technique } from "@/lib/food-db";
import { Badge, Card, Input, Skeleton } from "@/components/ui";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";

/** Render a guide body: preserve line breaks and **bold** spans. */
function GuideBody({ text }: { text: string }) {
  return (
    <div className="space-y-1.5 text-sm text-[var(--text-muted)] leading-relaxed">
      {text.split("\n").map((line, i) => (
        <p key={i}>
          {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
            part.startsWith("**") && part.endsWith("**") ? (
              <strong key={j} className="text-[var(--text)] font-medium">
                {part.slice(2, -2)}
              </strong>
            ) : (
              part
            ),
          )}
        </p>
      ))}
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
        subtitle="Cooking techniques, step by step — the craft behind the recipes."
      />

      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--text-muted)]" />
        <Input
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
            <h2 className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wide mb-3">
              {category}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {items.map((t) => {
                const open = openId === t.id;
                return (
                  <Card
                    key={t.id}
                    className="cursor-pointer transition-colors hover:border-[var(--terracotta-q)]"
                    onClick={() => setOpenId(open ? null : t.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <ChefHat className="size-4 text-[var(--accent)]" />
                        <h3 className="font-medium">{t.title}</h3>
                      </div>
                      <ChevronDown
                        className={cn(
                          "size-4 text-[var(--text-muted)] transition-transform shrink-0",
                          open && "rotate-180",
                        )}
                      />
                    </div>
                    <p className="text-sm text-[var(--text-muted)] mt-1.5">
                      {t.summary}
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <Badge
                        tone={
                          t.difficulty === "easy"
                            ? "fresh"
                            : t.difficulty === "hard"
                              ? "expired"
                              : "soon"
                        }
                      >
                        {t.difficulty}
                      </Badge>
                      {t.minutes !== undefined && (
                        <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
                          <Clock className="size-3" /> {t.minutes} min
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
