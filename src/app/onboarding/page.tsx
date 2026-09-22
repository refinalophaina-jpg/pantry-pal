"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button, Input, Label, Segmented } from "@/components/ui";

export default function OnboardingPage() {
  const { user, household, loading, createHousehold, joinHousehold, signOut } =
    useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/sign-in");
    else if (household) router.replace("/");
  }, [user, household, loading, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r =
        tab === "create"
          ? await createHousehold(name)
          : await joinHousehold(code);
      if (r.error) setError(r.error);
      else router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[var(--bg)] px-4 py-10">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl sm:text-3xl">Set up your household</h1>
        <p className="mb-6 mt-1 text-sm text-[var(--text-muted)]">
          A household shares one pantry, shopping list and meal plan. Create yours or join with an invite code.
        </p>

        <Segmented
          label="Create or join"
          className="mb-5 w-full"
          value={tab}
          onChange={setTab}
          options={[
            { value: "create", label: "Create" },
            { value: "join", label: "Join" },
          ]}
        />

        <form onSubmit={submit} className="space-y-4">
          {tab === "create" ? (
            <div>
              <Label htmlFor="household-name">Household name</Label>
              <Input
                id="household-name"
                placeholder="e.g. The Smith Kitchen"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          ) : (
            <div>
              <Label htmlFor="household-invite">Invite code</Label>
              <Input
                id="household-invite"
                placeholder="e.g. A1B2C3D4"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="font-mono tracking-wider"
              />
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Your partner finds it under Invite partner.
              </p>
            </div>
          )}

          {error && (
            <div role="alert" className="rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Working…" : tab === "create" ? "Create household" : "Join household"}
          </Button>
        </form>

        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => signOut()}
            className="min-h-11 text-sm text-[var(--text-muted)] underline-offset-4 hover:text-[var(--text)] hover:underline"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
