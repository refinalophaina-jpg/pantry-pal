"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Home, Users } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button, Card, Input } from "@/components/ui";

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
    const r =
      tab === "create" ? await createHousehold(name) : await joinHousehold(code);
    setBusy(false);
    if (r.error) setError(r.error);
    else router.replace("/");
  }

  return (
    <div className="min-h-screen grid place-items-center px-4 bg-[var(--bg)]">
      <Card className="w-full max-w-md">
        <h1 className="text-xl font-semibold mb-1">Set up your household</h1>
        <p className="text-sm text-[var(--text-muted)] mb-5">
          Households share a pantry, shopping list, and meal plan. Create a new
          one or join your partner&apos;s with their invite code.
        </p>

        <div className="grid grid-cols-2 gap-2 mb-5 bg-[var(--bg)] p-1 rounded-lg">
          <button
            onClick={() => setTab("create")}
            className={`text-sm rounded-md py-1.5 transition-colors cursor-pointer ${
              tab === "create"
                ? "bg-[var(--surface)] shadow-sm font-medium"
                : "text-[var(--text-muted)]"
            }`}
          >
            <Home className="size-3.5 inline mr-1" /> Create
          </button>
          <button
            onClick={() => setTab("join")}
            className={`text-sm rounded-md py-1.5 transition-colors cursor-pointer ${
              tab === "join"
                ? "bg-[var(--surface)] shadow-sm font-medium"
                : "text-[var(--text-muted)]"
            }`}
          >
            <Users className="size-3.5 inline mr-1" /> Join
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {tab === "create" ? (
            <div>
              <label className="text-xs text-[var(--text-muted)] block mb-1">
                Household name
              </label>
              <Input
                placeholder="e.g. The Smith Kitchen"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          ) : (
            <div>
              <label className="text-xs text-[var(--text-muted)] block mb-1">
                Invite code
              </label>
              <Input
                placeholder="e.g. A1B2C3D4"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="font-mono tracking-wider"
              />
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Ask your partner to share theirs from Settings → Invite.
              </p>
            </div>
          )}

          {error && (
            <div className="text-sm text-[var(--danger)] bg-[var(--danger-soft)] rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Working…" : tab === "create" ? "Create household" : "Join"}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => signOut()}
          className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] mt-5"
        >
          Sign out
        </button>
      </Card>
    </div>
  );
}
