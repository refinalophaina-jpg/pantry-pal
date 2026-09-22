"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Search,
  ScanBarcode,
  Camera,
  Pencil,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { sortPantry, type SortMode } from "@/lib/pantry-sort";
import { QuantityStepper } from "@/components/quantity-stepper";
import { useSyncedActions } from "@/lib/data-sync";
import { useAuth } from "@/lib/auth-context";
import { apiRequest } from "@/lib/api-client";
import {
  Button,
  EmptyState,
  Input,
  Label,
  Modal,
  Segmented,
  Select,
} from "@/components/ui";
import { PageHeader } from "@/components/page-header";
import {
  IngredientAutocomplete,
  pantryCategoryFor,
} from "@/components/ingredient-autocomplete";
import { lookupProduct, type ScannedProduct } from "@/lib/barcode";
import { NutritionFacts } from "@/components/nutrition-facts";
import { useToast } from "@/components/toast";
import { useAction } from "@/lib/use-action";
import { expiryStatus, uid, cn } from "@/lib/utils";
import type { PantryItem, StorageZone, UnitType } from "@/lib/types";

const UNITS: UnitType[] = ["pcs", "g", "kg", "ml", "l", "tbsp", "tsp", "cup"];
const ZONES: StorageZone[] = ["pantry", "fridge", "freezer"];
const CATEGORIES = [
  "Produce",
  "Protein",
  "Dairy",
  "Grains",
  "Frozen",
  "Pantry staple",
  "Condiments",
  "Oils",
  "Snacks",
  "Beverages",
  "Other",
];

type ZoneFilter = StorageZone | "all";
const ZONE_OPTIONS: { value: ZoneFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pantry", label: "Pantry" },
  { value: "fridge", label: "Fridge" },
  { value: "freezer", label: "Freezer" },
];

function statusClass(tone: ReturnType<typeof expiryStatus>["tone"]) {
  if (tone === "expired") return "text-[var(--danger)]";
  if (tone === "today" || tone === "soon") return "text-[var(--warn)]";
  return "text-[var(--text-muted)]";
}

export default function PantryPage() {
  const pantry = useAppStore((s) => s.pantry);
  const {
    addPantryItem,
    updatePantryItem,
    removePantryItem,
    consumeItem,
  } = useSyncedActions();
  const run = useAction();

  const [query, setQuery] = useState("");
  const [zone, setZone] = useState<ZoneFilter>("all");
  const [open, setOpen] = useState<"add" | "scan" | "photo" | null>(null);
  const [editing, setEditing] = useState<PantryItem | null>(null);
  const [sort, setSort] = useState<SortMode>("expiry");
  // Drag a pantry row onto a zone filter to move it there.
  const [dragId, setDragId] = useState<string | null>(null);
  const [overZone, setOverZone] = useState<StorageZone | null>(null);

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
      .filter(
        (p) =>
          !query ||
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.category.toLowerCase().includes(query.toLowerCase()),
      );
    return sortPantry(matched, sort);
  }, [pantry, zone, query, sort]);

  return (
    <div>
      <PageHeader
        title="Pantry"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setOpen("scan")}>
              <ScanBarcode className="size-4" /> Scan
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setOpen("photo")}>
              <Camera className="size-4" /> Photo
            </Button>
            <Button size="sm" onClick={() => setOpen("add")}>
              <Plus className="size-4" /> Add item
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-faint)]" aria-hidden="true" />
          <Input
            aria-label="Search pantry"
            placeholder="Search items or categories…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
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
          <Select
            aria-label="Sort items"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
            className="w-40"
          >
            <option value="expiry">Expiring first</option>
            <option value="name">Name (A–Z)</option>
            <option value="added">Recently added</option>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={pantry.length === 0 ? "Your pantry is empty" : "No items match"}
          description={
            pantry.length === 0
              ? "Add your first item, scan a barcode, or take a photo of your groceries."
              : "Try a different search or zone."
          }
          action={pantry.length === 0 ? <Button onClick={() => setOpen("add")}><Plus className="size-4" /> Add item</Button> : undefined}
        />
      ) : (
        <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {filtered.map((item) => {
            const s = expiryStatus(item.expiresOn);
            return (
              <li
                key={item.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", item.id);
                  e.dataTransfer.effectAllowed = "move";
                  setDragId(item.id);
                }}
                onDragEnd={() => {
                  setDragId(null);
                  setOverZone(null);
                }}
                className={cn(
                  "flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 sm:flex-nowrap",
                  dragId === item.id && "opacity-50",
                )}
              >
                <div className="min-w-0 flex-1 basis-40">
                  <div className="font-medium">{item.name}</div>
                  <div className="text-sm text-[var(--text-muted)]">
                    {item.category} · {item.zone}
                    {item.notes ? ` · ${item.notes}` : ""}
                  </div>
                </div>
                <span className={cn("shrink-0 text-sm font-medium sm:w-28 sm:text-right", statusClass(s.tone))}>
                  {s.label}
                </span>
                <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
                  <QuantityStepper
                    quantity={item.quantity}
                    unit={item.unit}
                    onChange={(q) =>
                      run(() => updatePantryItem(item.id, { quantity: q }), {
                        error: "Couldn't update the quantity — try again.",
                      })
                    }
                  />
                  <div className="flex items-center gap-1">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        run(() => consumeItem(item.id, 1, "used"), {
                          success: `Used 1 ${item.unit} of ${item.name}.`,
                          error: "Couldn't update the pantry — try again.",
                        })
                      }
                    >
                      Use 1
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="px-2.5"
                      onClick={() => setEditing(item)}
                      aria-label="Edit"
                      title={`Edit ${item.name}`}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AddItemModal
        open={open === "add"}
        onClose={() => setOpen(null)}
        onAdd={(item) =>
          run(() => addPantryItem(item), {
            success: `${item.name} added to ${item.zone}.`,
            error: "Couldn't add the item — try again.",
          })
        }
      />
      <EditItemModal
        item={editing}
        onClose={() => setEditing(null)}
        onSave={(patch) => editing
          ? run(() => updatePantryItem(editing.id, patch), {
              success: `${editing.name} updated.`,
              error: "Couldn't save changes — try again.",
            })
          : Promise.resolve(false)
        }
        onWaste={() => editing
          ? run(() => consumeItem(editing.id, editing.quantity, "wasted"), {
              success: `${editing.name} marked wasted.`,
              successKind: "warn",
              error: "Couldn't update the pantry — try again.",
            })
          : Promise.resolve(false)
        }
        onDelete={() => editing
          ? run(() => removePantryItem(editing.id), {
              success: `${editing.name} removed.`,
              error: "Couldn't remove the item — try again.",
            })
          : Promise.resolve(false)
        }
      />
      <ScanModal
        open={open === "scan"}
        onClose={() => setOpen(null)}
        onAdd={addPantryItem}
      />
      <PhotoModal
        open={open === "photo"}
        onClose={() => setOpen(null)}
        onAdd={addPantryItem}
      />
    </div>
  );
}

function AddItemModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (item: Omit<PantryItem, "id" | "addedOn">) => Promise<boolean>;
}) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState<UnitType>("pcs");
  const [zone, setZone] = useState<StorageZone>("pantry");
  const [category, setCategory] = useState("Other");
  const [expiresOn, setExpiresOn] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const saved = await onAdd({
        name: name.trim(), quantity, unit, zone, category,
        expiresOn: expiresOn || undefined,
      });
      if (!saved) return;
      setName("");
      setQuantity(1);
      setExpiresOn("");
      onClose();
    } finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={() => { if (!saving) onClose(); }} title="Add pantry item">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <div>
          <Label htmlFor="add-name">Ingredient name</Label>
          <IngredientAutocomplete
            id="add-name"
            autoFocus
            placeholder="e.g. Chicken breast"
            value={name}
            onChange={setName}
            onSelect={(ing) => {
              setName(ing.name);
              setCategory(pantryCategoryFor(ing.category));
            }}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="add-quantity">Quantity</Label>
            <Input
              id="add-quantity"
              type="number"
              min={0}
              step="0.1"
              placeholder="Quantity"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="add-unit">Unit</Label>
            <Select id="add-unit" value={unit} onChange={(e) => setUnit(e.target.value as UnitType)}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="add-zone">Stored in</Label>
            <Select id="add-zone" value={zone} onChange={(e) => setZone(e.target.value as StorageZone)}>
              {ZONES.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="add-category">Category</Label>
            <Select id="add-category" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="add-expires">Expires on (optional)</Label>
          <Input
            id="add-expires"
            type="date"
            value={expiresOn}
            onChange={(e) => setExpiresOn(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>{saving ? "Adding…" : "Add"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function EditItemModal({
  item,
  onClose,
  onSave,
  onWaste,
  onDelete,
}: {
  item: PantryItem | null;
  onClose: () => void;
  onSave: (patch: Partial<PantryItem>) => Promise<boolean>;
  onWaste: () => Promise<boolean>;
  onDelete: () => Promise<boolean>;
}) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState<UnitType>("pcs");
  const [zone, setZone] = useState<StorageZone>("pantry");
  const [category, setCategory] = useState("Other");
  const [expiresOn, setExpiresOn] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!item) return;
    setName(item.name);
    setQuantity(item.quantity);
    setUnit(item.unit);
    setZone(item.zone);
    setCategory(item.category);
    setExpiresOn(item.expiresOn ?? "");
    setNotes(item.notes ?? "");
  }, [item]);

  async function submit() {
    if (!item || saving) return;
    setSaving(true);
    try {
      const saved = await onSave({
        name: name.trim() || item.name,
        quantity, unit, zone, category, expiresOn, notes,
      });
      if (saved) onClose();
    } finally { setSaving(false); }
  }

  async function act(task: () => Promise<boolean>) {
    if (!item || saving) return;
    setSaving(true);
    try {
      const done = await task();
      if (done) onClose();
    } finally { setSaving(false); }
  }

  return (
    <Modal open={item !== null} onClose={() => { if (!saving) onClose(); }} title="Edit item">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <div>
          <Label htmlFor="edit-name">Name</Label>
          <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="edit-quantity">Quantity</Label>
            <Input
              id="edit-quantity"
              type="number"
              min={0}
              step="0.1"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="edit-unit">Unit</Label>
            <Select id="edit-unit" value={unit} onChange={(e) => setUnit(e.target.value as UnitType)}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="edit-zone">Stored in</Label>
            <Select id="edit-zone" value={zone} onChange={(e) => setZone(e.target.value as StorageZone)}>
              {ZONES.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="edit-category">Category</Label>
            <Select id="edit-category" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="edit-expires">Expires on</Label>
          <Input
            id="edit-expires"
            type="date"
            value={expiresOn}
            onChange={(e) => setExpiresOn(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="edit-notes">Notes (optional)</Label>
          <Input
            id="edit-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. half-open, use first"
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-4">
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" disabled={saving} onClick={() => void act(onWaste)} className="text-[var(--warn)] hover:text-[var(--warn)]">
              Mark wasted
            </Button>
            <Button variant="ghost" size="sm" disabled={saving} onClick={() => void act(onDelete)} className="text-[var(--danger)] hover:text-[var(--danger)]">
              Delete
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function ScanModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (item: Omit<PantryItem, "id" | "addedOn">) => void | Promise<void>;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Scan barcode">
      {open && <ScanInner onClose={onClose} onAdd={onAdd} />}
    </Modal>
  );
}

function ScanInner({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (item: Omit<PantryItem, "id" | "addedOn">) => void | Promise<void>;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [status, setStatus] = useState<
    "idle" | "starting" | "running" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [product, setProduct] = useState<ScannedProduct | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const { toast } = useToast();

  // Decode happened — now resolve the number to a real product (Open Food Facts).
  async function resolveCode(text: string) {
    setCode(text);
    setLookingUp(true);
    setNotFound(false);
    const found = await lookupProduct(text);
    setLookingUp(false);
    if (found) {
      setProduct(found);
    } else {
      setNotFound(true);
      setProduct({ name: "", category: "Other", source: "manual" }); // manual entry
    }
  }

  async function start() {
    setStatus("starting");
    setError(null);
    try {
      // getUserMedia only exists in a secure context (https or localhost).
      // Opening the dev server over a LAN IP (http://192.168.x.x) has no camera.
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        throw new Error(
          "Camera needs a secure (https) connection. Open the site over https and allow camera access.",
        );
      }
      if (!videoRef.current) throw new Error("Video not ready — try again.");

      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      // Prefer the rear camera via facingMode. This is far more reliable than
      // enumerating devices and matching labels — labels and deviceIds are
      // empty until camera permission has been granted, so the old label-match
      // path would fall back to an invalid deviceId and never start.
      const controls = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } } },
        videoRef.current,
        (result) => {
          if (result) {
            const text = result.getText();
            controls.stop();
            setStatus("idle");
            void resolveCode(text);
          }
        },
      );
      controlsRef.current = controls;
      setStatus("running");
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      const name = e instanceof Error ? e.name : "";
      const friendly = /NotAllowedError|Permission|denied/i.test(name + raw)
        ? "Camera permission was blocked. Allow camera access for this site in your browser settings, then try again."
        : /NotFoundError|No camera|device not found/i.test(name + raw)
          ? "No camera was found on this device. Use “Simulate” or add the item manually."
          : /NotReadableError|in use|could not start/i.test(name + raw)
            ? "The camera is being used by another app. Close it and try again."
            : raw;
      setError(friendly);
      setStatus("error");
    }
  }

  function stop() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setStatus("idle");
  }

  function manualEntry() {
    // No camera handy — jump straight to the editable confirm card.
    setCode(null);
    setNotFound(true);
    setProduct({ name: "", category: "Other", source: "manual" });
  }

  function resetScan() {
    setProduct(null);
    setCode(null);
    setNotFound(false);
  }

  async function commit() {
    if (!product || !product.name.trim()) return;
    try {
      await onAdd({
        name: product.name.trim(),
        category: product.category,
        quantity: 1,
        unit: "pcs",
        zone: "pantry",
      });
      toast(`${product.name} added.`);
      setCode(null);
      setProduct(null);
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't add item.", "warn");
    }
  }

  useEffect(() => {
    return () => {
      controlsRef.current?.stop();
    };
  }, []);

  return (
    <div className="space-y-3">
      {lookingUp ? (
        <div className="border border-[var(--border)] rounded-lg p-6 grid place-items-center text-sm text-[var(--text-muted)]">
          Looking up barcode {code}…
        </div>
      ) : product ? (
        <div className="border border-[var(--border)] rounded-lg p-4 space-y-3">
          <div className="text-xs text-[var(--text-muted)]">
            {code ? `Barcode ${code}` : "Manual entry"}
            {notFound && code ? " · not in database, enter details" : ""}
          </div>
          <div>
            <Label htmlFor="scan-name">Item name</Label>
            <Input
              id="scan-name"
              autoFocus
              value={product.name}
              onChange={(e) => setProduct({ ...product, name: e.target.value })}
              placeholder="e.g. Black beans (can)"
            />
          </div>
          <div>
            <Label htmlFor="scan-category">Category</Label>
            <Select
              id="scan-category"
              value={product.category}
              onChange={(e) =>
                setProduct({ ...product, category: e.target.value })
              }
            >
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </div>
          {product.nutrition && (
            <NutritionFacts
              nutrition={product.nutrition}
              servingSize={product.servingSize}
              nutriScore={product.nutriScore}
            />
          )}
        </div>
      ) : (
        <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-[var(--border)]">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            autoPlay
            playsInline
            muted
          />
          {status !== "running" && (
            <div className="absolute inset-0 grid place-items-center text-center px-4 text-white text-sm bg-black/60">
              {status === "starting" && "Starting camera…"}
              {status === "idle" && "Tap Start to use camera."}
              {status === "error" && (
                <div>
                  <div className="font-medium mb-1">Camera unavailable</div>
                  <div className="text-xs text-white/70">{error}</div>
                </div>
              )}
            </div>
          )}
          {status === "running" && (
            <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-0.5 bg-red-500" />
          )}
        </div>
      )}
      <div className="flex justify-end gap-2 flex-wrap">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        {product ? (
          <>
            <Button variant="secondary" onClick={resetScan}>
              Re-scan
            </Button>
            <Button onClick={commit} disabled={!product.name.trim()}>
              Add to pantry
            </Button>
          </>
        ) : status === "running" ? (
          <Button variant="secondary" onClick={stop}>
            Stop
          </Button>
        ) : lookingUp ? null : (
          <>
            <Button variant="secondary" onClick={manualEntry}>
              Enter manually
            </Button>
            <Button onClick={start} disabled={status === "starting"}>
              <ScanBarcode className="size-4" />{" "}
              {status === "starting" ? "Starting…" : "Start camera"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function PhotoModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (item: Omit<PantryItem, "id" | "addedOn">) => void | Promise<void>;
}) {
  const { household, user } = useAuth();
  const [detected, setDetected] = useState<
    Array<{ id: string; name: string; category: string; include: boolean }>
  >([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const generation = useRef(0);
  useEffect(() => {
    generation.current++;
    setDetected([]);
    setError(null);
    setAnalyzing(false);
    setSaving(false);
    return () => { generation.current++; };
  }, [open, household?.id, user?.id]);

  async function analyze(file: File) {
    const revision = generation.current;
    setAnalyzing(true);
    setError(null);
    setDetected([]);
    try {
      if (!household) throw new Error("Choose a household before analyzing a photo.");
      if (file.size > 5 * 1024 * 1024) throw new Error("Choose a photo smaller than 5 MB.");
      const base64 = await fileToBase64(file);
      if (revision !== generation.current) return;
      const mediaType = file.type || "image/jpeg";
      const data = await apiRequest<{ items: Array<{ name: string; category: string }> }>("/api/pantry/recognize", {
        method: "POST", body: { householdId: household.id, imageBase64: base64, mediaType }, timeoutMs: 45_000,
      });
      if (revision !== generation.current) return;

      const items = (data?.items ?? []) as Array<{
        name: string;
        category: string;
      }>;
      if (items.length === 0) {
        setError("No food items detected — try a clearer, closer photo.");
      } else {
        setDetected(items.map((i) => ({ ...i, id: uid(), include: true })));
      }
    } catch (e) {
      if (revision === generation.current) setError(e instanceof Error ? e.message : "Couldn't analyze the photo.");
    } finally {
      if (revision === generation.current) setAnalyzing(false);
    }
  }

  function update(idx: number, patch: Partial<(typeof detected)[number]>) {
    setDetected((arr) => arr.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  }

  async function commit() {
    if (saving) return;
    const revision = generation.current;
    const chosen = detected.filter((d) => d.include && d.name.trim());
    if (chosen.length === 0) return;
    setSaving(true);
    try {
      for (const it of chosen) {
        if (revision !== generation.current) return;
        await onAdd({
          name: it.name.trim(),
          category: it.category,
          quantity: 1,
          unit: "pcs",
          zone: "fridge",
        });
        if (revision !== generation.current) return;
        // Retrying a partial failure must not insert already confirmed rows again.
        setDetected((items) => items.filter((item) => item.id !== it.id));
      }
      toast(`Added ${chosen.length} item${chosen.length === 1 ? "" : "s"} from photo.`);
      setDetected([]);
      onClose();
    } catch (e) {
      if (revision === generation.current) toast(e instanceof Error ? e.message : "Couldn't add remaining items.", "warn");
    } finally {
      if (revision === generation.current) setSaving(false);
    }
  }

  const includedCount = detected.filter((d) => d.include).length;

  return (
    <Modal open={open} onClose={onClose} title="Photo → ingredients">
      {detected.length === 0 ? (
        <>
          <p className="text-sm text-[var(--text-muted)] mb-3">
            Take or upload a photo of your groceries. Items are recognised
            automatically, and you confirm each one before it is added.
          </p>
          <label className="mb-1 block cursor-pointer rounded-xl border border-dashed border-[var(--border)] p-6 text-center hover:bg-[var(--bg)] aria-disabled:opacity-60">
            <Camera className="size-6 mx-auto text-[var(--text-muted)] mb-2" />
            <p className="text-sm">
              {analyzing ? "Recognizing items…" : "Tap to take or upload a photo"}
            </p>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              disabled={analyzing}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) analyze(f);
              }}
            />
          </label>
          {error && (
            <p className="text-sm text-[var(--danger)] bg-[var(--danger-soft)] rounded-lg px-3 py-2 mt-3">
              {error}
            </p>
          )}
        </>
      ) : (
        <>
          <p className="mb-2 text-sm text-[var(--text-muted)]">
            Untick anything wrong, fix names, then add them to your fridge.
          </p>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto mb-3 pr-1">
            {detected.map((d, i) => (
              <div key={d.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  disabled={saving}
                  checked={d.include}
                  onChange={(e) => update(i, { include: e.target.checked })}
                  className="size-4 accent-[var(--accent)] shrink-0"
                />
                <Input
                  disabled={saving}
                  value={d.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                  className="flex-1"
                />
                <Select
                  disabled={saving}
                  value={d.category}
                  onChange={(e) => update(i, { category: e.target.value })}
                  className="w-32 shrink-0"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </div>
            ))}
          </div>
        </>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        {detected.length > 0 && (
          <Button onClick={commit} disabled={saving || includedCount === 0}>
            {saving ? "Adding…" : `Add ${includedCount} item${includedCount === 1 ? "" : "s"}`}
          </Button>
        )}
      </div>
    </Modal>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(",") + 1)); // strip data: prefix
    };
    reader.onerror = () => reject(new Error("Couldn't read the image file."));
    reader.readAsDataURL(file);
  });
}
