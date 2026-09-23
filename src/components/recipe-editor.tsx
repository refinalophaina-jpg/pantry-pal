"use client";

import { useEffect, useState } from "react";
import { Camera, Sparkles, Trash2, X } from "lucide-react";
import { FoodVisual } from "./food-visual";
import { Button, Input, Label, Modal, Select, Textarea } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { useSyncedActions } from "@/lib/data-sync";
import { uploadRecipeImage } from "@/lib/images";
import { illustrateRecipe } from "@/lib/recipe-ai";
import { useToast } from "@/components/toast";
import { useAppStore } from "@/lib/store";
import type { Recipe, UnitType } from "@/lib/types";

const UNITS: UnitType[] = ["pcs", "g", "kg", "ml", "l", "tbsp", "tsp", "cup"];
const CUISINES = ["Vietnamese", "Thai", "Nigerian", "Indian", "Chinese", "Japanese", "Korean", "Italian", "French", "Greek", "Mexican", "Moroccan", "British", "American", "International"];

type Row = { name: string; quantity: string; unit: UnitType; optional: boolean };

export type EditorMode = { kind: "new" } | { kind: "edit"; recipe: Recipe } | { kind: "copy"; recipe: Recipe; keepName?: boolean };

function rowsFrom(recipe?: Recipe): Row[] {
  const rows = (recipe?.ingredients ?? []).map(item => ({ name: item.name, quantity: String(item.quantity), unit: item.unit, optional: Boolean(item.optional) }));
  return rows.length ? rows : [{ name: "", quantity: "1", unit: "pcs", optional: false }];
}

/**
 * One editor for new, edited and copied recipes. Saves through the household
 * API; photos are uploaded (downsized first) or generated on request.
 */
export function RecipeEditor({ mode, onClose, onSaved }: { mode: EditorMode | null; onClose: () => void; onSaved?: (recipe: Recipe) => void }) {
  const { household } = useAuth();
  const { saveRecipe, updateSavedRecipe } = useSyncedActions();
  const { toast } = useToast();
  const base = mode && mode.kind !== "new" ? mode.recipe : undefined;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [cuisine, setCuisine] = useState("International");
  const [minutes, setMinutes] = useState("30");
  const [difficulty, setDifficulty] = useState<Recipe["difficulty"]>("easy");
  const [servings, setServings] = useState("2");
  const [tags, setTags] = useState("");
  const [rows, setRows] = useState<Row[]>(rowsFrom());
  const [steps, setSteps] = useState("");
  const [source, setSource] = useState("");
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [busy, setBusy] = useState<"" | "save" | "upload" | "illustrate">("");

  useEffect(() => {
    if (!mode) return;
    setName(mode.kind === "copy" && !mode.keepName ? `${base!.name} (my version)` : base?.name ?? "");
    setDescription(base?.description ?? "");
    setCuisine(base?.cuisine ?? "International");
    setMinutes(String(base?.minutes ?? 30));
    setDifficulty(base?.difficulty ?? "easy");
    setServings(String(base?.servings ?? 2));
    setTags((base?.tags ?? []).filter(tag => tag !== "drafted").join(", "));
    setRows(rowsFrom(base));
    setSteps((base?.steps ?? []).join("\n"));
    setSource(base?.source && /^https?:\/\//i.test(base.source) ? base.source : "");
    setImageUrl(base?.imageUrl);
    setBusy("");
    // The form mirrors whichever recipe the editor was opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  if (!mode) return null;
  const title = mode.kind === "new" ? "New recipe" : mode.kind === "edit" ? "Edit recipe" : "Copy to my recipes";

  function updateRow(index: number, patch: Partial<Row>) { setRows(list => list.map((row, i) => (i === index ? { ...row, ...patch } : row))); }

  function collect(): Recipe {
    const ingredients = rows.filter(row => row.name.trim()).map(row => {
      const quantity = Number(row.quantity);
      return { name: row.name.trim(), quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1, unit: row.unit, ...(row.optional ? { optional: true } : {}) };
    });
    const stepList = steps.split("\n").map(line => line.replace(/^\s*\d+[.)]\s*/, "").trim()).filter(Boolean);
    if (!name.trim()) throw new Error("Give the recipe a name.");
    if (!ingredients.length) throw new Error("Add at least one ingredient.");
    if (!stepList.length) throw new Error("Write at least one step.");
    const parsedMinutes = Math.round(Number(minutes)); const parsedServings = Math.round(Number(servings));
    return {
      id: base?.id ?? "new", name: name.trim(), description: description.trim(), cuisine: cuisine.trim() || "International",
      minutes: Number.isFinite(parsedMinutes) && parsedMinutes > 0 ? Math.min(parsedMinutes, 10080) : 30, difficulty,
      servings: Number.isFinite(parsedServings) && parsedServings > 0 ? Math.min(parsedServings, 100) : 2,
      equipment: base?.equipment ?? [], ingredients, steps: stepList,
      tags: tags.split(",").map(tag => tag.trim()).filter(Boolean).slice(0, 12),
      imageUrl, source: source.trim() || undefined, area: base?.area, video: base?.video,
      externalId: mode!.kind === "copy" ? `copy-${base!.externalId ?? base!.id}` : base?.externalId,
    };
  }

  async function submit() {
    if (busy) return;
    setBusy("save");
    try {
      const recipe = collect();
      let saved: Recipe;
      if (mode!.kind === "edit" && base?.savedId) saved = await updateSavedRecipe(base.savedId, recipe);
      else {
        const id = await saveRecipe(recipe);
        saved = useAppStore.getState().savedRecipes.find(item => item.id === id) ?? { ...recipe, id };
      }
      toast(mode!.kind === "edit" ? "Recipe updated." : `${saved.name} saved to My Recipes.`);
      onSaved?.(saved);
      onClose();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save the recipe.", "warn");
    } finally { setBusy(""); }
  }

  async function upload(file: File) {
    if (!household || busy) return;
    setBusy("upload");
    try { setImageUrl(await uploadRecipeImage(household.id, file)); toast("Photo added."); }
    catch (error) { toast(error instanceof Error ? error.message : "Could not upload the photo.", "warn"); }
    finally { setBusy(""); }
  }

  async function illustrate() {
    if (!household || busy) return;
    if (!name.trim()) { toast("Name the recipe first so the illustration matches it.", "warn"); return; }
    setBusy("illustrate");
    try { setImageUrl(await illustrateRecipe(household.id, { name: name.trim(), description: description.trim(), cuisine })); toast("Illustration ready. Save to keep it."); }
    catch (error) { toast(error instanceof Error ? error.message : "Could not generate an illustration.", "warn"); }
    finally { setBusy(""); }
  }

  return (
    <Modal open={Boolean(mode)} onClose={() => { if (!busy) onClose(); }} title={title} size="lg">
      <form className="space-y-5" onSubmit={event => { event.preventDefault(); void submit(); }}>
        <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
          <div className="space-y-2">
            <FoodVisual name={name || "New recipe"} imageUrl={imageUrl} />
            <div className="flex flex-wrap gap-1.5">
              <label className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] aria-disabled:opacity-50" aria-disabled={Boolean(busy)}>
                <Camera className="size-4" aria-hidden="true" /> {busy === "upload" ? "Uploading…" : "Photo"}
                <input type="file" accept="image/*" className="sr-only" disabled={Boolean(busy)} onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = ""; }} />
              </label>
              <Button type="button" variant="secondary" size="sm" className="min-h-9" onClick={illustrate} disabled={Boolean(busy)} title="Generate a plate illustration with the assistant">
                <Sparkles className="size-4" aria-hidden="true" /> {busy === "illustrate" ? "Drawing…" : "Illustrate"}
              </Button>
              {imageUrl && (
                <Button type="button" variant="ghost" size="sm" className="min-h-9" onClick={() => setImageUrl(undefined)} disabled={Boolean(busy)} aria-label="Remove photo">
                  <X className="size-4" aria-hidden="true" />
                </Button>
              )}
            </div>
            <p className="text-xs text-[var(--text-faint)]">Photos are private to your household. Illustrations are generated and may not match exactly.</p>
          </div>
          <div className="space-y-3">
            <div>
              <Label htmlFor="rx-name">Name</Label>
              <Input id="rx-name" value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Tomato tofu with spring onion" autoFocus />
            </div>
            <div>
              <Label htmlFor="rx-description">Description</Label>
              <Input id="rx-description" value={description} onChange={event => setDescription(event.target.value)} placeholder="One appetising sentence" />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1.8fr_1fr_1fr_1.2fr]">
              <div className="col-span-2 sm:col-span-1">
                <Label htmlFor="rx-cuisine">Cuisine</Label>
                <Input id="rx-cuisine" list="rx-cuisines" value={cuisine} onChange={event => setCuisine(event.target.value)} />
                <datalist id="rx-cuisines">{CUISINES.map(item => <option key={item} value={item} />)}</datalist>
              </div>
              <div>
                <Label htmlFor="rx-minutes">Minutes</Label>
                <Input id="rx-minutes" type="number" min={1} inputMode="numeric" value={minutes} onChange={event => setMinutes(event.target.value)} />
              </div>
              <div>
                <Label htmlFor="rx-servings">Servings</Label>
                <Input id="rx-servings" type="number" min={1} inputMode="numeric" value={servings} onChange={event => setServings(event.target.value)} />
              </div>
              <div>
                <Label htmlFor="rx-difficulty">Difficulty</Label>
                <Select id="rx-difficulty" value={difficulty} onChange={event => setDifficulty(event.target.value as Recipe["difficulty"])}>
                  <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <Label className="mb-0">Ingredients</Label>
            <Button type="button" variant="ghost" size="sm" onClick={() => setRows(list => [...list, { name: "", quantity: "1", unit: "pcs", optional: false }])}>Add ingredient</Button>
          </div>
          <ul className="space-y-2">
            {rows.map((row, index) => (
              <li key={index} className="grid grid-cols-[1fr_72px_80px_auto_auto] items-center gap-2">
                <Input aria-label={`Ingredient ${index + 1} name`} value={row.name} onChange={event => updateRow(index, { name: event.target.value })} placeholder="Ingredient" />
                <Input aria-label={`Ingredient ${index + 1} quantity`} type="number" min={0} step="0.01" inputMode="decimal" value={row.quantity} onChange={event => updateRow(index, { quantity: event.target.value })} />
                <Select aria-label={`Ingredient ${index + 1} unit`} value={row.unit} onChange={event => updateRow(index, { unit: event.target.value as UnitType })}>
                  {UNITS.map(unit => <option key={unit} value={unit}>{unit}</option>)}
                </Select>
                <label className="inline-flex min-h-11 items-center gap-1.5 text-xs text-[var(--text-muted)]">
                  <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={row.optional} onChange={event => updateRow(index, { optional: event.target.checked })} /> optional
                </label>
                <Button type="button" variant="ghost" size="sm" className="px-2" aria-label={`Remove ingredient ${index + 1}`} onClick={() => setRows(list => list.length > 1 ? list.filter((_, i) => i !== index) : list)}>
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <Label htmlFor="rx-steps">Steps, one per line</Label>
          <Textarea id="rx-steps" rows={6} value={steps} onChange={event => setSteps(event.target.value)} placeholder={"Heat the oil over medium heat.\nAdd the onion and cook 5 minutes."} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="rx-tags">Tags, comma separated</Label>
            <Input id="rx-tags" value={tags} onChange={event => setTags(event.target.value)} placeholder="vegetarian, quick, batch" />
          </div>
          <div>
            <Label htmlFor="rx-source">Source link (optional)</Label>
            <Input id="rx-source" type="url" value={source} onChange={event => setSource(event.target.value)} placeholder="https://" />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={Boolean(busy)}>Cancel</Button>
          <Button type="submit" disabled={Boolean(busy)}>{busy === "save" ? "Saving…" : mode.kind === "edit" ? "Save changes" : "Save recipe"}</Button>
        </div>
      </form>
    </Modal>
  );
}
