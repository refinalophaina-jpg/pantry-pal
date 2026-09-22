"use client";

/*
 * Design-system gallery — an unlinked reference route (not in the nav).
 * Renders the primitives and a few composed patterns so the look can be
 * reviewed (and screenshotted for visual regression) without signing in.
 */

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  Button,
  Badge,
  Input,
  Select,
  Segmented,
  EmptyState,
  SectionTitle,
} from "@/components/ui";
import { ThemeToggle } from "@/components/theme-toggle";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <SectionTitle>{title}</SectionTitle>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </section>
  );
}

export default function PreviewPage() {
  const [zone, setZone] = useState<"all" | "pantry" | "fridge" | "freezer">("all");
  return (
    <div className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-3xl space-y-10">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/illustrations/logo.svg"
              alt=""
              aria-hidden="true"
              className="size-10 rounded-lg"
              draggable={false}
            />
            <div>
              <h1 className="text-2xl leading-tight">Pantry Pal — Design system</h1>
              <p className="text-sm text-[var(--text-muted)]">
                Warm paper, one terracotta accent, moss for fresh. Flat surfaces, no texture.
              </p>
            </div>
          </div>
          <div className="w-40">
            <ThemeToggle />
          </div>
        </header>

        <Section title="Buttons">
          <Button>
            <Plus className="size-4" /> Primary
          </Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">
            <Trash2 className="size-4" /> Danger
          </Button>
          <Button size="sm">Small</Button>
          <Button disabled>Disabled</Button>
        </Section>

        <Section title="Status">
          <Badge>default</Badge>
          <Badge tone="fresh">5d left</Badge>
          <Badge tone="soon">2d left</Badge>
          <Badge tone="today">today</Badge>
          <Badge tone="expired">expired</Badge>
          <Badge tone="info">info</Badge>
        </Section>

        <Section title="Inputs">
          <div className="grid w-full gap-3 sm:grid-cols-2">
            <Input placeholder="Search ingredients…" />
            <Select defaultValue="">
              <option value="" disabled>
                Storage zone…
              </option>
              <option>Pantry</option>
              <option>Fridge</option>
              <option>Freezer</option>
            </Select>
          </div>
          <Segmented
            label="Zone"
            value={zone}
            onChange={setZone}
            options={[
              { value: "all", label: "All" },
              { value: "pantry", label: "Pantry" },
              { value: "fridge", label: "Fridge" },
              { value: "freezer", label: "Freezer" },
            ]}
          />
        </Section>

        <Section title="Lists">
          <ul className="w-full divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {[
              ["Spinach", "1 pcs · fridge", "Expires today", "text-[var(--warn)]"],
              ["Greek yogurt", "500 g · fridge", "2d left", "text-[var(--warn)]"],
              ["Tomatoes", "4 pcs · pantry", "5d left", "text-[var(--text-muted)]"],
            ].map(([name, meta, status, tone]) => (
              <li key={name} className="flex items-center justify-between gap-4 py-2.5">
                <span>
                  <span className="block font-medium">{name}</span>
                  <span className="block text-sm text-[var(--text-muted)]">{meta}</span>
                </span>
                <span className={`text-sm font-medium ${tone}`}>{status}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Empty state">
          <div className="w-full">
            <EmptyState
              title="Your pantry is empty"
              description="Scan a barcode, snap a photo, or add items by hand to get started."
              action={
                <Button>
                  <Plus className="size-4" /> Add first item
                </Button>
              }
            />
          </div>
        </Section>

        <Section title="Type scale">
          <div className="w-full space-y-1">
            <h1 className="text-3xl">Page title — DM Serif Display</h1>
            <p className="text-base font-medium">Section title — Outfit medium</p>
            <p className="text-base">
              Body copy in Outfit at regular weight. Cook more, waste less: an
              unhurried kitchen companion.
            </p>
            <p className="text-sm text-[var(--text-muted)]">Secondary text at 14px, muted.</p>
            <p className="font-mono text-sm tabular-nums text-[var(--text-muted)]">
              1,240 kcal · 86 g protein · ABCD-1234 (JetBrains Mono)
            </p>
          </div>
        </Section>
      </div>
    </div>
  );
}
