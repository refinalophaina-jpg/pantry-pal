"use client";

/*
 * Design-system gallery — an unlinked reference route (not in the nav).
 * Renders the AinaDara primitives and a few composed patterns so the look can
 * be reviewed (and screenshotted for visual regression) without signing in.
 */

import { Refrigerator, Plus, Trash2, Sparkles } from "lucide-react";
import {
  Button,
  Card,
  Badge,
  Input,
  Select,
  EmptyState,
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
      <h2 className="text-xl">{title}</h2>
      <div className="flex flex-wrap gap-3 items-center">{children}</div>
    </section>
  );
}

export default function PreviewPage() {
  return (
    <div className="min-h-screen px-6 py-10">
      <div className="max-w-3xl mx-auto space-y-10">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/illustrations/logo.svg"
              alt="Pantry Pal"
              className="size-10 rounded-xl shadow-sm"
              draggable={false}
            />
            <div>
              <h1 className="text-2xl leading-tight">Pantry Pal — Design system</h1>
              <p className="text-sm text-[var(--text-muted)]">
                AinaDara tokens · warm paper · terracotta / purple / moss
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

        <Section title="Badges">
          <Badge>default</Badge>
          <Badge tone="fresh">5d left</Badge>
          <Badge tone="soon">2d left</Badge>
          <Badge tone="today">today</Badge>
          <Badge tone="expired">expired</Badge>
          <Badge tone="info">info</Badge>
        </Section>

        <Section title="Inputs">
          <div className="w-full grid sm:grid-cols-2 gap-3">
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
        </Section>

        <Section title="Cards">
          <div className="w-full grid sm:grid-cols-2 gap-4">
            <Card className="space-y-2">
              <div className="flex items-center gap-2 text-[var(--accent)]">
                <Sparkles className="size-4" />
                <span className="font-medium text-[var(--text)]">
                  Cook with what you have
                </span>
              </div>
              <p className="text-sm text-[var(--text-muted)]">
                12 recipes you can make right now from your pantry.
              </p>
              <div className="flex gap-2 pt-1">
                <Badge tone="fresh">8 ready</Badge>
                <Badge tone="info">4 close</Badge>
              </div>
            </Card>
            <Card className="space-y-2">
              <div className="flex items-center gap-2 text-[var(--text)]">
                <Refrigerator className="size-4" />
                <span className="font-medium">Expiring soon</span>
              </div>
              <ul className="text-sm text-[var(--text-muted)] space-y-1">
                <li className="flex justify-between">
                  <span>Spinach</span> <Badge tone="today">today</Badge>
                </li>
                <li className="flex justify-between">
                  <span>Greek yogurt</span> <Badge tone="soon">2d</Badge>
                </li>
                <li className="flex justify-between">
                  <span>Tomatoes</span> <Badge tone="fresh">5d</Badge>
                </li>
              </ul>
            </Card>
          </div>
        </Section>

        <Section title="Empty state">
          <div className="w-full">
            <EmptyState
              title="Your pantry is empty"
              description="Scan a barcode, snap a photo, or add items by hand to get started."
              illustration="/illustrations/empty-pantry.svg"
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
            <h1 className="text-3xl">Display heading — DM Serif</h1>
            <h2 className="text-2xl">Section heading — DM Serif</h2>
            <p className="text-base">
              Body copy in Outfit, set light. Cook more, waste less — a deliberate,
              unhurried kitchen companion.
            </p>
            <p className="font-mono text-sm text-[var(--text-muted)]">
              1,240 kcal · 86 g protein · ABCD-1234 (JetBrains Mono)
            </p>
          </div>
        </Section>
      </div>
    </div>
  );
}
