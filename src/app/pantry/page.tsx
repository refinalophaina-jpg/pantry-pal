"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Search,
  ScanBarcode,
  Camera,
  Trash2,
  Minus,
  Pencil,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  Select,
} from "@/components/ui";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/components/toast";
import { expiryStatus } from "@/lib/utils";
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

export default function PantryPage() {
  const pantry = useAppStore((s) => s.pantry);
  const addPantryItem = useAppStore((s) => s.addPantryItem);
  const updatePantryItem = useAppStore((s) => s.updatePantryItem);
  const removePantryItem = useAppStore((s) => s.removePantryItem);
  const consumeItem = useAppStore((s) => s.consumeItem);
  const { toast } = useToast();

  const [query, setQuery] = useState("");
  const [zone, setZone] = useState<StorageZone | "all">("all");
  const [open, setOpen] = useState<"add" | "scan" | "photo" | null>(null);
  const [editing, setEditing] = useState<PantryItem | null>(null);

  const filtered = useMemo(() => {
    return pantry
      .filter((p) => (zone === "all" ? true : p.zone === zone))
      .filter(
        (p) =>
          !query ||
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.category.toLowerCase().includes(query.toLowerCase()),
      )
      .sort((a, b) => {
        const ad = a.expiresOn ?? "9999-99-99";
        const bd = b.expiresOn ?? "9999-99-99";
        return ad.localeCompare(bd);
      });
  }, [pantry, zone, query]);

  return (
    <div>
      <PageHeader
        title="Pantry"
        subtitle="Track what you have, where it lives, and when it expires."
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setOpen("scan")}
            >
              <ScanBarcode className="size-4" /> Scan
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setOpen("photo")}
            >
              <Camera className="size-4" /> Photo
            </Button>
            <Button size="sm" onClick={() => setOpen("add")}>
              <Plus className="size-4" /> Add item
            </Button>
          </>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <Input
            placeholder="Search items or categories…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {(["all", ...ZONES] as const).map((z) => (
            <Button
              key={z}
              variant={zone === z ? "primary" : "secondary"}
              size="sm"
              onClick={() => setZone(z)}
            >
              <span className="capitalize">{z}</span>
            </Button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No items match"
          description="Try a different filter, or add a new pantry item."
          action={<Button onClick={() => setOpen("add")}><Plus className="size-4" /> Add item</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((item) => {
            const s = expiryStatus(item.expiresOn);
            return (
              <Card key={item.id} className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {item.category} · {item.zone}
                    </div>
                  </div>
                  <Badge tone={s.tone === "none" ? "default" : s.tone}>
                    {s.label}
                  </Badge>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-semibold">{item.quantity}</span>
                  <span className="text-sm text-[var(--text-muted)]">
                    {item.unit}
                  </span>
                </div>
                <div className="flex gap-2 mt-auto">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      consumeItem(item.id, 1, "used");
                      toast(`Used 1 ${item.unit} of ${item.name}.`);
                    }}
                  >
                    <Minus className="size-3.5" /> Use 1
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      consumeItem(item.id, item.quantity, "wasted");
                      toast(`${item.name} marked wasted.`, "warn");
                    }}
                  >
                    Wasted
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    onClick={() => setEditing(item)}
                    aria-label="Edit"
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removePantryItem(item.id)}
                    aria-label="Delete"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <AddItemModal
        open={open === "add"}
        onClose={() => setOpen(null)}
        onAdd={(item) => {
          addPantryItem(item);
          toast(`${item.name} added to ${item.zone}.`);
        }}
      />
      <EditItemModal
        item={editing}
        onClose={() => setEditing(null)}
        onSave={(patch) => {
          if (editing) {
            updatePantryItem(editing.id, patch);
            toast(`${editing.name} updated.`);
          }
        }}
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
  onAdd: ReturnType<typeof useAppStore.getState>["addPantryItem"];
}) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState<UnitType>("pcs");
  const [zone, setZone] = useState<StorageZone>("pantry");
  const [category, setCategory] = useState("Other");
  const [expiresOn, setExpiresOn] = useState("");

  function submit() {
    if (!name.trim()) return;
    onAdd({
      name: name.trim(),
      quantity,
      unit,
      zone,
      category,
      expiresOn: expiresOn || undefined,
    });
    setName("");
    setQuantity(1);
    setExpiresOn("");
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Add pantry item">
      <div className="space-y-3">
        <Input
          autoFocus
          placeholder="e.g. Chicken breast"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            type="number"
            min={0}
            step="0.1"
            placeholder="Quantity"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
          />
          <Select
            value={unit}
            onChange={(e) => setUnit(e.target.value as UnitType)}
          >
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select
            value={zone}
            onChange={(e) => setZone(e.target.value as StorageZone)}
          >
            {ZONES.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </Select>
          <Select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="text-xs text-[var(--text-muted)] block mb-1">
            Expires on (optional)
          </label>
          <Input
            type="date"
            value={expiresOn}
            onChange={(e) => setExpiresOn(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Add</Button>
        </div>
      </div>
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
  onAdd: ReturnType<typeof useAppStore.getState>["addPantryItem"];
}) {
  return (
    <Modal open={open} onClose={onClose} title="Scan barcode">
      {open && <ScanInner onClose={onClose} onAdd={onAdd} />}
    </Modal>
  );
}

function EditItemModal({
  item,
  onClose,
  onSave,
}: {
  item: PantryItem | null;
  onClose: () => void;
  onSave: (patch: Partial<PantryItem>) => void;
}) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState<UnitType>("pcs");
  const [zone, setZone] = useState<StorageZone>("pantry");
  const [category, setCategory] = useState("Other");
  const [expiresOn, setExpiresOn] = useState("");
  const [notes, setNotes] = useState("");

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

  function submit() {
    if (!item) return;
    onSave({
      name: name.trim() || item.name,
      quantity,
      unit,
      zone,
      category,
      expiresOn: expiresOn || undefined,
      notes: notes || undefined,
    });
    onClose();
  }

  return (
    <Modal open={item !== null} onClose={onClose} title="Edit item">
      <div className="space-y-3">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input
            type="number"
            min={0}
            step="0.1"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
          />
          <Select
            value={unit}
            onChange={(e) => setUnit(e.target.value as UnitType)}
          >
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select
            value={zone}
            onChange={(e) => setZone(e.target.value as StorageZone)}
          >
            {ZONES.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </Select>
          <Select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="text-xs text-[var(--text-muted)] block mb-1">
            Expires on
          </label>
          <Input
            type="date"
            value={expiresOn}
            onChange={(e) => setExpiresOn(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-[var(--text-muted)] block mb-1">
            Notes (optional)
          </label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. half-open, use first"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Save</Button>
        </div>
      </div>
    </Modal>
  );
}

const UPC_LOOKUP: Record<string, { name: string; category: string }> = {};
const SAMPLE_PRODUCTS = [
  { name: "Greek yogurt", category: "Dairy" },
  { name: "Sourdough loaf", category: "Grains" },
  { name: "Almond butter", category: "Condiments" },
  { name: "Black beans (can)", category: "Pantry staple" },
  { name: "Cheddar cheese", category: "Dairy" },
  { name: "Salsa verde", category: "Condiments" },
];

function lookupUpc(code: string): { name: string; category: string } {
  if (UPC_LOOKUP[code]) return UPC_LOOKUP[code];
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) | 0;
  const pick = SAMPLE_PRODUCTS[Math.abs(h) % SAMPLE_PRODUCTS.length];
  UPC_LOOKUP[code] = pick;
  return pick;
}

function ScanInner({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: ReturnType<typeof useAppStore.getState>["addPantryItem"];
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [status, setStatus] = useState<
    "idle" | "starting" | "running" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [product, setProduct] = useState<{ name: string; category: string } | null>(null);
  const { toast } = useToast();

  async function start() {
    setStatus("starting");
    setError(null);
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      const back = devices.find((d) => /back|rear|environment/i.test(d.label));
      const deviceId = back?.deviceId ?? devices[0]?.deviceId;
      if (!deviceId) throw new Error("No camera available");
      if (!videoRef.current) throw new Error("Video not ready");
      const controls = await reader.decodeFromVideoDevice(
        deviceId,
        videoRef.current,
        (result) => {
          if (result) {
            const text = result.getText();
            setCode(text);
            setProduct(lookupUpc(text));
            controls.stop();
            setStatus("idle");
          }
        },
      );
      controlsRef.current = controls;
      setStatus("running");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setStatus("error");
    }
  }

  function stop() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setStatus("idle");
  }

  function simulate() {
    const fake = `89012${Math.floor(Math.random() * 1e8)}`;
    setCode(fake);
    setProduct(lookupUpc(fake));
  }

  function commit() {
    if (!product) return;
    onAdd({
      name: product.name,
      category: product.category,
      quantity: 1,
      unit: "pcs",
      zone: "pantry",
    });
    toast(`${product.name} added.`);
    setCode(null);
    setProduct(null);
    onClose();
  }

  useEffect(() => {
    return () => {
      controlsRef.current?.stop();
    };
  }, []);

  return (
    <div className="space-y-3">
      {product ? (
        <div className="border border-[var(--border)] rounded-lg p-4 bg-[var(--accent-soft)]">
          <div className="text-xs text-[var(--text-muted)]">UPC {code}</div>
          <div className="font-semibold text-lg mt-0.5">{product.name}</div>
          <div className="text-xs text-[var(--text-muted)]">{product.category}</div>
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
            <Button
              variant="secondary"
              onClick={() => {
                setProduct(null);
                setCode(null);
              }}
            >
              Re-scan
            </Button>
            <Button onClick={commit}>Add to pantry</Button>
          </>
        ) : status === "running" ? (
          <Button variant="secondary" onClick={stop}>
            Stop
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={simulate}>
              Simulate
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
  onAdd: ReturnType<typeof useAppStore.getState>["addPantryItem"];
}) {
  const [detected, setDetected] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const { toast } = useToast();

  function fakeAnalyze(_file: File) {
    setAnalyzing(true);
    setTimeout(() => {
      setDetected([
        "Tomatoes",
        "Basil",
        "Mozzarella",
        "Olive oil",
        "Garlic",
      ]);
      setAnalyzing(false);
    }, 1200);
  }

  function commit() {
    detected.forEach((name) =>
      onAdd({
        name,
        category: "Produce",
        quantity: 1,
        unit: "pcs",
        zone: "fridge",
      }),
    );
    toast(`Added ${detected.length} items from photo.`);
    setDetected([]);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Photo → ingredients">
      <p className="text-sm text-[var(--text-muted)] mb-3">
        Vision OCR is stubbed in v0.1. Upload an image to see the planned UX —
        production will call a vision model server-side to detect groceries.
      </p>
      <label className="border-2 border-dashed border-[var(--border)] rounded-lg p-6 text-center mb-3 block cursor-pointer hover:bg-[var(--bg)]">
        <Camera className="size-6 mx-auto text-[var(--text-muted)] mb-2" />
        <p className="text-sm">Click to upload a grocery photo</p>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) fakeAnalyze(f);
          }}
        />
      </label>
      {analyzing && (
        <p className="text-sm text-[var(--text-muted)]">Analyzing image…</p>
      )}
      {detected.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-[var(--text-muted)] mb-2">
            Detected ingredients
          </div>
          <div className="flex flex-wrap gap-2">
            {detected.map((d) => (
              <Badge key={d} tone="fresh">
                {d}
              </Badge>
            ))}
          </div>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        {detected.length > 0 && (
          <Button onClick={commit}>Add {detected.length} items</Button>
        )}
      </div>
    </Modal>
  );
}
