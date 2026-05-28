"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { CheckCircle2, Info, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastKind = "success" | "info" | "warn";
interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
}

interface Ctx {
  toast: (message: string, kind?: ToastKind) => void;
}

const ToastCtx = createContext<Ctx | null>(null);

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const toast = useCallback((message: string, kind: ToastKind = "success") => {
    const id = Math.random().toString(36).slice(2);
    setItems((arr) => [...arr, { id, kind, message }]);
    setTimeout(() => {
      setItems((arr) => arr.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  function dismiss(id: string) {
    setItems((arr) => arr.filter((t) => t.id !== id));
  }

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-20 lg:bottom-6 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {items.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);
  const Icon =
    toast.kind === "success"
      ? CheckCircle2
      : toast.kind === "warn"
        ? AlertTriangle
        : Info;
  const tone =
    toast.kind === "success"
      ? "border-[var(--accent)] text-[var(--accent-hover)]"
      : toast.kind === "warn"
        ? "border-[var(--warn)] text-[var(--warn)]"
        : "border-[var(--info)] text-[var(--info)]";
  return (
    <div
      className={cn(
        "relative pointer-events-auto bg-[var(--surface)] border-l-4 border border-[var(--border)] rounded-lg shadow-lg px-4 py-3 pr-10 min-w-[260px] max-w-sm flex items-center gap-3 transition-all",
        tone,
        visible ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="text-sm text-[var(--text)]">{toast.message}</span>
      <button
        onClick={onDismiss}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)]"
        aria-label="Dismiss"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
