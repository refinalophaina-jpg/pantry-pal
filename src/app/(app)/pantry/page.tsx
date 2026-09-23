"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, ScanBarcode, Camera, Pencil, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useAppStore } from "@/lib/store";
import { sortPantry, type SortMode } from "@/lib/pantry-sort";
import { QuantityStepper } from "@/components/quantity-stepper";
import { useSyncedActions } from "@/lib/data-sync";
import { useAuth } from "@/lib/auth-context";
import { apiRequest } from "@/lib/api-client";
import { Button, EmptyState, Input, Label, Modal, SectionTitle, Segmented, Select, Textarea } from "@/components/ui";
import { PageHeader } from "@/components/page-header";
import { lookupProduct, type ScannedProduct } from "@/lib/barcode";
import { NutritionFacts } from "@/components/nutrition-facts";
import { useToast } from "@/components/toast";
import { useAction } from "@/lib/use-action";
import { expiryStatus, uid, cn } from "@/lib/utils";
import { guessCategory, guessZone, parseQuickAdd, type QuickAddItem } from "@/lib/quick-add";
import { formatRange, SHELF_LIFE_SOURCE, shelfLifeFor, suggestedExpiry } from "@/lib/shelf-life";
import { lookupNutrition } from "@/lib/nutrition";
import type { PantryItem, StorageZone, UnitType } from "@/lib/types";

const UNITS: UnitType[] = ["pcs", "g", "kg", "ml", "l", "tbsp", "tsp", "cup"];
const ZONES: StorageZone[] = ["pantry", "fridge", "freezer"];
const CATEGORIES = ["Produce", "Protein", "Dairy", "Grains", "Frozen", "Pantry staple", "Condiments", "Oils", "Snacks", "Beverages", "Other"];

type ZoneFilter = StorageZone | "all";
const ZONE_OPTIONS: { value: ZoneFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pantry", label: "Pantry" },
  { value: "fridge", label: "Fridge" },
  { value: "freezer", label: "Freezer" },
];
type AddMode = "type" | "scan" | "photo";
type NewItem = Omit<PantryItem, "id" | "addedOn">;

function statusClass(tone: ReturnType<typeof expiryStatus>["tone"]) {
  if (tone === "expired") return "text-[var(--danger)]";
  if (tone === "today" || tone === "soon") return "text-[var(--warn)]";
  return "text-[var(--text-muted)]";
}

export default function PantryPage() {
  const pantry = useAppStore((s) => s.pantry);
  const { addPantryItem, updatePantryItem, removePantryItem, consumeItem } = useSyncedActions();
  const run = useAction();

  const [query, setQuery] = useState("");
  const [zone, setZone] = useState<ZoneFilter>("all");
  const [adding, setAdding] = useState<AddMode | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>("expiry");
  // Drag a pantry row onto a zone filter to move it there.
  const [dragId, setDragId] = useState<string | null>(null);
  const [overZone, setOverZone] = useState<StorageZone | null>(null);
  const detail = detailId ? pantry.find((item) => item.id === detailId) ?? null : null;

  function dropOnZone(e: React.DragEvent, z: StorageZone) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || dragId;
    setDragId(null);
    setOverZone(null);
    const it = id && pantry.find((p) => p.id === id);
    if (!it || it.zone === z) return;
    run(() => updatePantryItem(id as string, { zone: z }), {
      success: `Moved ${it.name} to ${z}.`,
      error: "Couldn't move the item — try again.",
    });
  }

  const filtered = useMemo(() => {
    const matched = pantry
      .filter((p) => (zone === "all" ? true : p.zone === zone))
      .filter((p) => !query || p.name.toLowerCase().includes(query.toLowerCase()) || p.category.toLowerCase().includes(query.toLowerCase()));
    return sortPantry(matched, sort);
  }, [pantry, zone, query, sort]);

  return (
    <div>
      <PageHeader
        title="Pantry"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setAdding("scan")}>
              <ScanBarcode className="size-4" /> Scan
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setAdding("photo")}>
              <Camera className="size-4" /> Photo
            </Button>
            <Button size="sm" onClick={() => setAdding("type")}>
              <Plus className="size-4" /> Add items
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-faint)]" aria-hidden="true" />
          <Input aria-label="Search pantry" placeholder="Search items or categories…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2">
          <Segmented
            label="Storage zone"
            value={zone}
            onChange={setZone}
            options={ZONE_OPTIONS}
            className="flex-1 sm:flex-none"
            itemProps={(z) => {
              if (z === "all" || dragId === null) return {};
              return {
                onDragOver: (e) => { e.preventDefault(); setOverZone(z); },
                onDragLeave: () => setOverZone(null),
                onDrop: (e) => dropOnZone(e, z),
                className: overZone === z ? "ring-2 ring-[var(--terracotta-q)]" : "",
              };
            }}
          />
          <Select aria-label="Sort items" value={sort} onChange={(e) => setSort(e.target.value as SortMode)} className="w-40">
            <option value="expiry">Expiring first</option>
            <option value="name">Name (A–Z)</option>
            <option value="added">Recently added</option>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={pantry.length === 0 ? "Your pantry is empty" : "No items match"}
          description={pantry.length === 0 ? "Type a few items in one go, scan a barcode, or photograph your groceries." : "Try a different search or zone."}
          action={pantry.length === 0 ? <Button onClick={() => setAdding("type")}><Plus className="size-4" /> Add items</Button> : undefined}
        />
      ) : (
        <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {filtered.map((item) => {
            const s = expiryStatus(item.expiresOn);
            return (
              <li
                key={item.id}
                draggable
                onDragStart={(e) => { e.dataTransfer.setData("text/plain", item.id); e.dataTransfer.effectAllowed = "move"; setDragId(item.id); }}
                onDragEnd={() => { setDragId(null); setOverZone(null); }}
                className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 sm:flex-nowrap", dragId === item.id && "opacity-50")}
              >
                <div className="min-w-0 flex-1 basis-40">
                  <button type="button" onClick={() => setDetailId(item.id)} className="cursor-pointer text-left font-medium hover:text-[var(--accent-hover)]" aria-label={`Details for ${item.name}`}>{item.name}</button>
                  <div className="text-sm text-[var(--text-muted)]">
                    {item.category} · {item.zone}
                    {item.notes ? ` · ${item.notes}` : ""}
                  </div>
                </div>
                <span className={cn("shrink-0 text-sm font-medium sm:w-28 sm:text-right", statusClass(s.tone))}>{s.label}</span>
                <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
                  <QuantityStepper quantity={item.quantity} unit={item.unit} onChange={(q) => run(() => updatePantryItem(item.id, { quantity: q }), { error: "Couldn't update the quantity — try again." })} />
                  <div className="flex items-center gap-1">
                    <Button variant="secondary" size="sm" onClick={() => run(() => consumeItem(item.id, 1, "used"), { success: `Used 1 ${item.unit} of ${item.name}.`, error: "Couldn't update the pantry — try again." })}>
                      Use 1
                    </Button>
                    <Button variant="ghost" size="sm" className="px-2.5" onClick={() => setDetailId(item.id)} aria-label="Edit" title={`Edit ${item.name}`}>
                      <Pencil className="size-4" />
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AddDialog mode={adding} onModeChange={setAdding} onClose={() => setAdding(null)} onAdd={addPantryItem} />
      <ItemSheet
        item={detail}
        onClose={() => setDetailId(null)}
        onSave={(patch) => detail ? run(() => updatePantryItem(detail.id, patch), { success: `${detail.name} updated.`, error: "Couldn't save changes — try again." }) : Promise.resolve(false)}
        onWaste={() => detail ? run(() => consumeItem(detail.id, detail.quantity, "wasted"), { success: `${detail.name} marked wasted.`, successKind: "warn", error: "Couldn't update the pantry — try again." }) : Promise.resolve(false)}
        onDelete={() => detail ? run(() => removePantryItem(detail.id), { success: `${detail.name} removed.`, error: "Couldn't remove the item — try again." }) : Promise.resolve(false)}
      />
    </div>
  );
}

/** One dialog, three ways in: type several items, scan a barcode, or photograph groceries. */
function AddDialog({ mode, onModeChange, onClose, onAdd }: { mode: AddMode | null; onModeChange: (mode: AddMode) => void; onClose: () => void; onAdd: (item: NewItem) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={mode !== null} onClose={() => { if (!busy) onClose(); }} title="Add to pantry" size="lg">
      <Segmented label="How to add" value={mode ?? "type"} onChange={onModeChange} className="mb-4 w-full" options={[{ value: "type", label: "Type" }, { value: "scan", label: "Scan" }, { value: "photo", label: "Photo" }]} />
      {mode === "type" && <QuickAddForm onAdd={onAdd} onClose={onClose} onBusy={setBusy} />}
      {mode === "scan" && <ScanInner onClose={onClose} onAdd={onAdd} />}
      {mode === "photo" && <PhotoInner onClose={onClose} onAdd={onAdd} onBusy={setBusy} />}
    </Modal>
  );
}

function QuickAddForm({ onAdd, onClose, onBusy }: { onAdd: (item: NewItem) => Promise<void>; onClose: () => void; onBusy: (busy: boolean) => void }) {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Array<QuickAddItem & { key: string; expiresOn: string }>>([]);
  const [saving, setSaving] = useState(false);
  const parsed = useMemo(() => parseQuickAdd(text), [text]);
  const preview = rows.length ? rows : parsed.map((item, index) => ({ ...item, key: String(index), expiresOn: "" }));

  function edit(key: string, patch: Partial<QuickAddItem & { expiresOn: string }>) {
    setRows((current) => (current.length ? current : preview).map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }
  function remove(key: string) { setRows((current) => (current.length ? current : preview).filter((row) => row.key !== key)); }

  async function submit() {
    if (!preview.length || saving) return;
    setSaving(true); onBusy(true);
    let added = 0;
    try {
      for (const row of preview) {
        await onAdd({ name: row.name, quantity: row.quantity, unit: row.unit, zone: row.zone, category: row.category, expiresOn: row.expiresOn || undefined });
        added++;
        setRows((current) => (current.length ? current : preview).filter((item) => item.key !== row.key));
      }
      toast(`${added} ${added === 1 ? "item" : "items"} added.`);
      setText(""); setRows([]);
      onClose();
    } catch (error) {
      toast(`${added ? `${added} added. ` : ""}${error instanceof Error ? error.message : "Couldn't add the rest."}`, "warn");
    } finally { setSaving(false); onBusy(false); }
  }

  return (
    <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <div>
        <Label htmlFor="quick-add">Items, one per line or separated by commas</Label>
        <Textarea id="quick-add" autoFocus rows={3} value={text} onChange={(event) => { setText(event.target.value); setRows([]); }} placeholder={"2 kg rice\n6 eggs (fridge)\nspinach 200 g\nfrozen peas"} disabled={saving} />
        <p className="mt-1 text-xs text-[var(--text-faint)]">Quantities and units are read from the text; zone and category are guessed and can be changed below.</p>
      </div>
      {preview.length > 0 && (
        <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {preview.map((row) => (
            <li key={row.key} className="grid grid-cols-[1fr_auto] items-center gap-2 py-2 sm:grid-cols-[1fr_88px_120px_128px_150px_auto]">
              <span className="min-w-0 truncate text-sm font-medium">{row.name}</span>
              <span className="text-sm tabular-nums text-[var(--text-muted)] sm:order-none">{row.quantity} {row.unit}</span>
              <Select aria-label={`Zone for ${row.name}`} value={row.zone} onChange={(event) => edit(row.key, { zone: event.target.value as StorageZone })} className="min-h-9 py-1 text-sm">
                {ZONES.map((z) => <option key={z} value={z}>{z}</option>)}
              </Select>
              <Select aria-label={`Category for ${row.name}`} value={row.category} onChange={(event) => edit(row.key, { category: event.target.value })} className="min-h-9 py-1 text-sm">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
              <Input aria-label={`Expiry for ${row.name}`} type="date" value={row.expiresOn} onChange={(event) => edit(row.key, { expiresOn: event.target.value })} className="min-h-9 py-1 text-sm" />
              <button type="button" aria-label={`Remove ${row.name}`} className="grid size-9 place-items-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg)] hover:text-[var(--text)]" onClick={() => remove(row.key)}><X className="size-4" /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button type="submit" disabled={saving || !preview.length}>{saving ? "Adding…" : `Add ${preview.length || ""} ${preview.length === 1 ? "item" : "items"}`}</Button>
      </div>
    </form>
  );
}

/** Everything about one item: dates, storage guidance, nutrition, history, and the edit form. */
function ItemSheet({ item, onClose, onSave, onWaste, onDelete }: { item: PantryItem | null; onClose: () => void; onSave: (patch: Partial<PantryItem>) => Promise<boolean>; onWaste: () => Promise<boolean>; onDelete: () => Promise<boolean> }) {
  const usage = useAppStore((s) => s.usage);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState<UnitType>("pcs");
  const [zone, setZone] = useState<StorageZone>("pantry");
  const [category, setCategory] = useState("Other");
  const [expiresOn, setExpiresOn] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState<"waste" | "delete" | null>(null);
  const [nutrition, setNutrition] = useState<Awaited<ReturnType<typeof lookupNutrition>> | "loading" | null>(null);

  useEffect(() => {
    if (!item) return;
    setName(item.name); setQuantity(item.quantity); setUnit(item.unit); setZone(item.zone); setCategory(item.category); setExpiresOn(item.expiresOn ?? ""); setNotes(item.notes ?? "");
    setConfirming(null);
    setNutrition("loading");
    let cancelled = false;
    lookupNutrition(item.name).then((value) => { if (!cancelled) setNutrition(value); }).catch(() => { if (!cancelled) setNutrition(null); });
    return () => { cancelled = true; };
  }, [item]);

  const life = item ? shelfLifeFor(item.name) : null;
  const history = useMemo(() => item ? usage.filter((event) => event.itemName.toLowerCase() === item.name.toLowerCase()).slice(0, 5) : [], [usage, item]);
  const status = expiryStatus(item?.expiresOn);

  async function submit() {
    if (!item || saving) return;
    setSaving(true);
    try {
      const saved = await onSave({ name: name.trim() || item.name, quantity, unit, zone, category, expiresOn, notes });
      if (saved) onClose();
    } finally { setSaving(false); }
  }
  async function act(task: () => Promise<boolean>) {
    if (!item || saving) return;
    setSaving(true);
    try { if (await task()) onClose(); } finally { setSaving(false); }
  }

  return (
    <Modal open={item !== null} onClose={() => { if (!saving) onClose(); }} title={item?.name ?? "Item"} size="lg">
      {item && (
        <div className="space-y-6">
          <p className={cn("text-sm", statusClass(status.tone))}>{status.label}{item.expiresOn ? ` · ${item.expiresOn}` : ""} · {item.quantity} {item.unit} in the {item.zone}</p>

          <section aria-labelledby="storage-title">
            <SectionTitle as="h3" className="mb-2"><span id="storage-title">Storage guidance</span></SectionTitle>
            {life ? (
              <div className="space-y-2 text-sm">
                <p className="text-[var(--text-muted)]">{life.label}, typical keeping times:</p>
                <ul className="flex flex-wrap gap-2">
                  {ZONES.filter((z) => life[z]).map((z) => (
                    <li key={z} className={cn("rounded-lg border px-3 py-1.5", z === zone ? "border-[var(--text)]" : "border-[var(--border)]")}>
                      <span className="capitalize">{z}</span>: {formatRange(life[z]!)}
                      {suggestedExpiry(life, z) && (
                        <button type="button" className="ml-2 text-xs text-[var(--accent-hover)] underline-offset-4 hover:underline" onClick={() => { setZone(z); setExpiresOn(suggestedExpiry(life, z)!); }}>set date</button>
                      )}
                    </li>
                  ))}
                </ul>
                {life.note && <p className="text-[var(--text-muted)]">{life.note}</p>}
                <p className="text-xs text-[var(--text-faint)]">Ranges from the <a className="underline" href={SHELF_LIFE_SOURCE.url} target="_blank" rel="noopener noreferrer">{SHELF_LIFE_SOURCE.name}</a> guidance, measured from purchase or opening. A printed use-by date wins.</p>
              </div>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">No keeping-time guidance for this name yet. Follow the package date; the <a className="underline" href={SHELF_LIFE_SOURCE.url} target="_blank" rel="noopener noreferrer">{SHELF_LIFE_SOURCE.name}</a> covers most foods.</p>
            )}
          </section>

          <section aria-labelledby="nutrition-title">
            <SectionTitle as="h3" className="mb-2"><span id="nutrition-title">Nutrition per 100 g</span></SectionTitle>
            {nutrition === "loading" ? (
              <p className="text-sm text-[var(--text-muted)]">Looking up…</p>
            ) : nutrition ? (
              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
                {([["Calories", nutrition.calories, "kcal"], ["Protein", nutrition.proteinG, "g"], ["Carbs", nutrition.carbsG, "g"], ["Fat", nutrition.fatG, "g"], ["Fibre", nutrition.fiberG, "g"]] as const).filter(([, value]) => value !== undefined).map(([label, value, suffix]) => (
                  <div key={label} className="rounded-lg border border-[var(--border)] p-3 text-center">
                    <dd className="text-lg font-medium tabular-nums">{Math.round((value as number) * 10) / 10}<span className="text-xs font-normal text-[var(--text-faint)]"> {suffix}</span></dd>
                    <dt className="text-xs text-[var(--text-muted)]">{label}</dt>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">No matched reference for this exact name. Try the preparation state, e.g. “Raw spinach” or “Cooked lentils”; see the <Link href="/food-guide/" className="underline" onClick={onClose}>food guide</Link>.</p>
            )}
          </section>

          {history.length > 0 && (
            <section aria-labelledby="history-title">
              <SectionTitle as="h3" className="mb-2"><span id="history-title">Recent use</span></SectionTitle>
              <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)] text-sm">
                {history.map((event) => <li key={event.id} className="flex justify-between py-1.5"><span>{event.quantity} {event.unit} {event.reason}</span><span className="text-[var(--text-muted)]">{event.at.slice(0, 10)}</span></li>)}
              </ul>
            </section>
          )}

          <form className="space-y-4 border-t border-[var(--border)] pt-5" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
            <SectionTitle as="h3">Edit details</SectionTitle>
            <div>
              <Label htmlFor="edit-name">Name</Label>
              <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <Label htmlFor="edit-quantity">Quantity</Label>
                <Input id="edit-quantity" type="number" min={0} step="0.1" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
              </div>
              <div>
                <Label htmlFor="edit-unit">Unit</Label>
                <Select id="edit-unit" value={unit} onChange={(e) => setUnit(e.target.value as UnitType)}>{UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</Select>
              </div>
              <div>
                <Label htmlFor="edit-zone">Stored in</Label>
                <Select id="edit-zone" value={zone} onChange={(e) => setZone(e.target.value as StorageZone)}>{ZONES.map((z) => <option key={z} value={z}>{z}</option>)}</Select>
              </div>
              <div>
                <Label htmlFor="edit-category">Category</Label>
                <Select id="edit-category" value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="edit-expires">Expires on</Label>
                <Input id="edit-expires" type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="edit-notes">Notes (optional)</Label>
                <Input id="edit-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. half-open, use first" />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-4">
              <div className="flex flex-wrap items-center gap-1">
                {confirming ? (
                  <span className="inline-flex items-center gap-1 text-sm">
                    <span className="text-[var(--text-muted)]">{confirming === "waste" ? `Mark all ${item.quantity} ${item.unit} wasted?` : "Delete this item?"}</span>
                    <Button variant="danger" size="sm" disabled={saving} onClick={() => void act(confirming === "waste" ? onWaste : onDelete)}>{confirming === "waste" ? "Mark wasted" : "Delete"}</Button>
                    <Button variant="ghost" size="sm" disabled={saving} onClick={() => setConfirming(null)}>Keep</Button>
                  </span>
                ) : (
                  <>
                    <Button variant="ghost" size="sm" disabled={saving} onClick={() => setConfirming("waste")} className="text-[var(--warn)] hover:text-[var(--warn)]">Mark wasted</Button>
                    <Button variant="ghost" size="sm" disabled={saving} onClick={() => setConfirming("delete")} className="text-[var(--danger)] hover:text-[var(--danger)]"><Trash2 className="size-4" /> Delete</Button>
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
                <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
              </div>
            </div>
          </form>
        </div>
      )}
    </Modal>
  );
}

function ScanInner({ onClose, onAdd }: { onClose: () => void; onAdd: (item: NewItem) => void | Promise<void> }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [status, setStatus] = useState<"idle" | "starting" | "running" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [product, setProduct] = useState<ScannedProduct | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const { toast } = useToast();

  // Decode happened; now resolve the number to a real product (catalog, then Open Food Facts).
  async function resolveCode(text: string) {
    setCode(text); setLookingUp(true); setNotFound(false);
    const found = await lookupProduct(text);
    setLookingUp(false);
    if (found) setProduct(found);
    else { setNotFound(true); setProduct({ name: "", category: "Other", source: "manual" }); }
  }

  async function start() {
    setStatus("starting"); setError(null);
    try {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) throw new Error("Camera needs a secure (https) connection. Open the site over https and allow camera access.");
      if (!videoRef.current) throw new Error("Video not ready — try again.");
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromConstraints({ video: { facingMode: { ideal: "environment" } } }, videoRef.current, (result) => {
        if (result) { const text = result.getText(); controls.stop(); setStatus("idle"); void resolveCode(text); }
      });
      controlsRef.current = controls;
      setStatus("running");
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      const kind = e instanceof Error ? e.name : "";
      const friendly = /NotAllowedError|Permission|denied/i.test(kind + raw)
        ? "Camera permission was blocked. Allow camera access for this site in your browser settings, then try again."
        : /NotFoundError|No camera|device not found/i.test(kind + raw)
          ? "No camera was found on this device. Enter the item manually instead."
          : /NotReadableError|in use|could not start/i.test(kind + raw)
            ? "The camera is being used by another app. Close it and try again."
            : raw;
      setError(friendly); setStatus("error");
    }
  }
  function stop() { controlsRef.current?.stop(); controlsRef.current = null; setStatus("idle"); }
  function manualEntry() { setCode(null); setNotFound(true); setProduct({ name: "", category: "Other", source: "manual" }); }
  function resetScan() { setProduct(null); setCode(null); setNotFound(false); }

  async function commit() {
    if (!product || !product.name.trim()) return;
    try {
      const name = product.name.trim();
      await onAdd({ name, category: product.category === "Other" ? guessCategory(name) : product.category, quantity: 1, unit: "pcs", zone: guessZone(name, product.category) });
      toast(`${name} added.`);
      setCode(null); setProduct(null);
      onClose();
    } catch (e) { toast(e instanceof Error ? e.message : "Couldn't add item.", "warn"); }
  }

  useEffect(() => () => { controlsRef.current?.stop(); }, []);

  return (
    <div className="space-y-3">
      {lookingUp ? (
        <div className="grid place-items-center rounded-lg border border-[var(--border)] p-6 text-sm text-[var(--text-muted)]">Looking up barcode {code}…</div>
      ) : product ? (
        <div className="space-y-3 rounded-lg border border-[var(--border)] p-4">
          <div className="text-xs text-[var(--text-muted)]">{code ? `Barcode ${code}` : "Manual entry"}{notFound && code ? " · not in the database, enter the details" : ""}</div>
          <div>
            <Label htmlFor="scan-name">Item name</Label>
            <Input id="scan-name" autoFocus value={product.name} onChange={(e) => setProduct({ ...product, name: e.target.value })} placeholder="e.g. Black beans (can)" />
          </div>
          <div>
            <Label htmlFor="scan-category">Category</Label>
            <Select id="scan-category" value={product.category} onChange={(e) => setProduct({ ...product, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select>
          </div>
          {product.nutrition && <NutritionFacts nutrition={product.nutrition} servingSize={product.servingSize} nutriScore={product.nutriScore} />}
        </div>
      ) : (
        <>
          <p className="text-sm text-[var(--text-muted)]">Point the camera at a packaged product's barcode. The name and label nutrition come from the shared catalog or Open Food Facts.</p>
          <div className="relative aspect-video overflow-hidden rounded-lg border border-[var(--border)] bg-black">
            <video ref={videoRef} className="h-full w-full object-cover" autoPlay playsInline muted />
            {status !== "running" && (
              <div className="absolute inset-0 grid place-items-center bg-black/60 px-4 text-center text-sm text-white">
                {status === "starting" && "Starting camera…"}
                {status === "idle" && "Tap Start camera."}
                {status === "error" && <div><div className="mb-1 font-medium">Camera unavailable</div><div className="text-xs text-white/70">{error}</div></div>}
              </div>
            )}
            {status === "running" && <div className="absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-red-500" />}
          </div>
        </>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        {product ? (
          <>
            <Button variant="secondary" onClick={resetScan}>Re-scan</Button>
            <Button onClick={commit} disabled={!product.name.trim()}>Add to pantry</Button>
          </>
        ) : status === "running" ? (
          <Button variant="secondary" onClick={stop}>Stop</Button>
        ) : lookingUp ? null : (
          <>
            <Button variant="secondary" onClick={manualEntry}>Enter manually</Button>
            <Button onClick={start} disabled={status === "starting"}><ScanBarcode className="size-4" /> {status === "starting" ? "Starting…" : "Start camera"}</Button>
          </>
        )}
      </div>
    </div>
  );
}

function PhotoInner({ onClose, onAdd, onBusy }: { onClose: () => void; onAdd: (item: NewItem) => void | Promise<void>; onBusy: (busy: boolean) => void }) {
  const { household, user } = useAuth();
  const [detected, setDetected] = useState<Array<{ id: string; name: string; category: string; zone: StorageZone; include: boolean }>>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const generation = useRef(0);
  useEffect(() => {
    generation.current++;
    setDetected([]); setError(null); setAnalyzing(false); setSaving(false);
    return () => { generation.current++; };
  }, [household?.id, user?.id]);

  async function analyze(file: File) {
    const revision = generation.current;
    setAnalyzing(true); onBusy(true); setError(null); setDetected([]);
    try {
      if (!household) throw new Error("Choose a household before analyzing a photo.");
      if (file.size > 5 * 1024 * 1024) throw new Error("Choose a photo smaller than 5 MB.");
      const base64 = await fileToBase64(file);
      if (revision !== generation.current) return;
      const mediaType = file.type || "image/jpeg";
      const data = await apiRequest<{ items: Array<{ name: string; category: string }> }>("/api/pantry/recognize", { method: "POST", body: { householdId: household.id, imageBase64: base64, mediaType }, timeoutMs: 45_000 });
      if (revision !== generation.current) return;
      const items = data?.items ?? [];
      if (items.length === 0) setError("No food was recognised. Try a closer, better-lit photo.");
      else setDetected(items.map((i) => { const category = pantryCategory(i.category, i.name); return { ...i, category, zone: guessZone(i.name, category), id: uid(), include: true }; }));
    } catch (e) {
      if (revision === generation.current) setError(e instanceof Error ? e.message : "Couldn't analyze the photo.");
    } finally {
      if (revision === generation.current) { setAnalyzing(false); onBusy(false); }
    }
  }

  function update(idx: number, patch: Partial<(typeof detected)[number]>) { setDetected((arr) => arr.map((d, i) => (i === idx ? { ...d, ...patch } : d))); }

  async function commit() {
    if (saving) return;
    const revision = generation.current;
    const chosen = detected.filter((d) => d.include && d.name.trim());
    if (chosen.length === 0) return;
    setSaving(true); onBusy(true);
    try {
      for (const it of chosen) {
        if (revision !== generation.current) return;
        await onAdd({ name: it.name.trim(), category: it.category, quantity: 1, unit: "pcs", zone: it.zone });
        if (revision !== generation.current) return;
        // Retrying a partial failure must not insert already confirmed rows again.
        setDetected((items) => items.filter((item) => item.id !== it.id));
      }
      toast(`Added ${chosen.length} item${chosen.length === 1 ? "" : "s"} from the photo.`);
      setDetected([]);
      onClose();
    } catch (e) {
      if (revision === generation.current) toast(e instanceof Error ? e.message : "Couldn't add the remaining items.", "warn");
    } finally {
      if (revision === generation.current) { setSaving(false); onBusy(false); }
    }
  }

  const includedCount = detected.filter((d) => d.include).length;

  return (
    <div className="space-y-3">
      {detected.length === 0 ? (
        <>
          <p className="text-sm text-[var(--text-muted)]">Photograph a shelf, a fridge, or the groceries you just unpacked. The assistant lists the foods it sees; you confirm each one before it is added. The photo is not stored.</p>
          <label className="block cursor-pointer rounded-xl border border-dashed border-[var(--border)] p-6 text-center hover:bg-[var(--bg)] aria-disabled:opacity-60">
            <Camera className="mx-auto mb-2 size-6 text-[var(--text-muted)]" />
            <p className="text-sm">{analyzing ? "Recognising foods…" : "Take or upload a photo"}</p>
            <input type="file" accept="image/*" capture="environment" className="hidden" disabled={analyzing} onChange={(e) => { const f = e.target.files?.[0]; if (f) void analyze(f); e.target.value = ""; }} />
          </label>
          {error && <p className="rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">{error}</p>}
        </>
      ) : (
        <>
          <p className="text-sm text-[var(--text-muted)]">Untick anything wrong, fix names and zones, then add them. Quantities start at 1; adjust them in the list afterwards.</p>
          <div className="mb-1 max-h-[50vh] space-y-2 overflow-y-auto pr-1">
            {detected.map((d, i) => (
              <div key={d.id} className="flex items-center gap-2">
                <input type="checkbox" disabled={saving} checked={d.include} onChange={(e) => update(i, { include: e.target.checked })} className="size-4 shrink-0 accent-[var(--accent)]" aria-label={`Include ${d.name}`} />
                <Input disabled={saving} value={d.name} onChange={(e) => update(i, { name: e.target.value })} className="flex-1" aria-label="Item name" />
                <Select disabled={saving} value={d.zone} onChange={(e) => update(i, { zone: e.target.value as StorageZone })} className="w-28 shrink-0" aria-label={`Zone for ${d.name}`}>{ZONES.map((z) => <option key={z}>{z}</option>)}</Select>
                <Select disabled={saving} value={d.category} onChange={(e) => update(i, { category: e.target.value })} className="hidden w-32 shrink-0 sm:block" aria-label={`Category for ${d.name}`}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select>
              </div>
            ))}
          </div>
        </>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
        {detected.length > 0 && <Button onClick={commit} disabled={saving || includedCount === 0}>{saving ? "Adding…" : `Add ${includedCount} item${includedCount === 1 ? "" : "s"}`}</Button>}
      </div>
    </div>
  );
}

/** The recogniser answers in the shared catalog's categories; the pantry keeps its shorter list. */
function pantryCategory(recognised: string, name: string) {
  const map: Record<string, string> = { Produce: "Produce", "Dairy & Eggs": "Dairy", "Meat & Seafood": "Protein", "Grains & Bread": "Grains", "Legumes & Nuts": "Protein", "Oils & Condiments": "Condiments", "Pantry & Spices": "Pantry staple", Frozen: "Frozen", Beverages: "Beverages" };
  return map[recognised] ?? guessCategory(name);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => { const result = String(reader.result); resolve(result.slice(result.indexOf(",") + 1)); };
    reader.onerror = () => reject(new Error("Couldn't read the image file."));
    reader.readAsDataURL(file);
  });
}
