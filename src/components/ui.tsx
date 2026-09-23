"use client";

import {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  forwardRef,
  useEffect,
  useId,
  useRef,
} from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden="true" />;
}

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function Card({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5",
          className,
        )}
        {...props}
      />
    );
  },
);

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary" | "ghost" | "danger";
    size?: "sm" | "md";
  }
>(function Button(
  { className, variant = "primary", size = "md", type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "px-3 py-1.5" : "px-4 py-2",
        variant === "primary" &&
          "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]",
        variant === "secondary" &&
          "border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--bg)]",
        variant === "ghost" &&
          "text-[var(--text-muted)] hover:bg-[var(--bg)] hover:text-[var(--text)]",
        variant === "danger" &&
          "bg-[var(--danger-soft)] text-[var(--danger)] hover:opacity-90",
        className,
      )}
      {...props}
    />
  );
});

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-base outline-none placeholder:text-[var(--text-faint)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] focus-visible:outline-none",
        className,
      )}
      {...props}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        "min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-base outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] focus-visible:outline-none",
        className,
      )}
      {...props}
    />
  );
});

/** Plain field label; keeps every form in the app on one vocabulary. */
export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1 block text-sm text-[var(--text-muted)]", className)}
      {...props}
    />
  );
}

/**
 * One-of-N control for filters (zones, scopes). Renders real buttons with
 * aria-pressed so it reads correctly to assistive tech.
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
  itemProps,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
  className?: string;
  itemProps?: (value: T) => ButtonHTMLAttributes<HTMLButtonElement>;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "inline-flex min-h-11 items-stretch rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            {...itemProps?.(option.value)}
            className={cn(
              "min-w-11 flex-1 cursor-pointer whitespace-nowrap rounded-md px-3 text-sm transition-colors",
              active
                ? "bg-[var(--bg)] font-medium text-[var(--text)]"
                : "text-[var(--text-muted)] hover:text-[var(--text)]",
              itemProps?.(option.value)?.className,
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Toggle chip for filters and multi-select choices; reads as pressed to assistive tech. */
export function Chip({
  active,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-9 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        active
          ? "border-[var(--text)] bg-[var(--text)] text-[var(--surface)]"
          : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:border-[var(--text-muted)] hover:text-[var(--text)]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "min-h-24 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-base leading-relaxed outline-none placeholder:text-[var(--text-faint)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] focus-visible:outline-none",
        className,
      )}
      {...props}
    />
  );
});

export function Badge({
  tone = "default",
  className,
  children,
}: {
  tone?: "default" | "fresh" | "soon" | "today" | "expired" | "info";
  className?: string;
  children: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    default: "bg-[var(--bg)] text-[var(--text-muted)]",
    fresh: "bg-[var(--fresh-soft)] text-[var(--fresh)]",
    soon: "bg-[var(--warn-soft)] text-[var(--warn)]",
    today: "bg-[var(--warn-soft)] text-[var(--warn)]",
    expired: "bg-[var(--danger-soft)] text-[var(--danger)]",
    info: "bg-[var(--info-soft)] text-[var(--info)]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Section heading inside a page: sans, medium weight, sentence case. */
export function SectionTitle({
  children,
  className,
  as: Tag = "h2",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "h2" | "h3";
}) {
  return (
    <Tag className={cn("text-base font-medium leading-snug", className)}>{children}</Tag>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** "lg" for editors and previews that need two columns. */
  size?: "md" | "lg";
}) {
  const titleId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open || !ref.current) return;
    const dialog = ref.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    const first = dialog.querySelector<HTMLElement>("input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),a[href]");
    (first ?? dialog).focus();
    return () => {
      if (typeof dialog.close === "function" && dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open]);
  if (!open) return null;
  return (
    <dialog
      ref={ref}
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      className="fixed inset-0 z-50 m-0 h-dvh max-h-none w-screen max-w-none bg-black/40 p-4 text-[var(--text)] open:flex open:items-center open:justify-center"
      onCancel={(event) => { event.preventDefault(); closeRef.current(); }}
      onClick={(event) => { if (event.target === event.currentTarget) closeRef.current(); }}
      onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); closeRef.current(); return; }
        if (event.key !== "Tab") return;
        const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]'));
        if (!focusable.length) { event.preventDefault(); return; }
        const first = focusable[0]; const last = focusable[focusable.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}
    >
      <div className={cn("w-full max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6", size === "lg" ? "max-w-2xl" : "max-w-md")}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id={titleId} className="pt-2 text-lg font-medium leading-snug">{title}</h2>
          <button type="button" aria-label={`Close ${title}`} className="size-11 shrink-0 rounded-lg text-2xl leading-none text-[var(--text-muted)] hover:bg-[var(--bg)] hover:text-[var(--text)]" onClick={() => closeRef.current()}>×</button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border)] px-5 py-10 text-center">
      <h3 className="font-medium">{title}</h3>
      {description && (
        <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--text-muted)]">
          {description}
        </p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
