"use client";

import { useCallback } from "react";
import { useToast } from "@/components/toast";

type Kind = "success" | "info" | "warn";

/**
 * Runs a store action (which writes to Supabase and throws on failure) with
 * consistent UX: the success toast fires only AFTER the write actually
 * succeeds, and a failure surfaces as a warning toast instead of an unhandled
 * promise rejection plus a misleading "success" message.
 *
 * Returns true on success, false on failure — handy for closing modals or
 * resetting inputs only when the write landed.
 */
export function useAction() {
  const { toast } = useToast();
  return useCallback(
    async (
      fn: () => unknown | Promise<unknown>,
      opts?: { success?: string; successKind?: Kind; error?: string },
    ): Promise<boolean> => {
      try {
        await fn();
        if (opts?.success) toast(opts.success, opts.successKind ?? "success");
        return true;
      } catch (e) {
        toast(
          opts?.error ??
            (e instanceof Error ? e.message : "Something went wrong"),
          "warn",
        );
        return false;
      }
    },
    [toast],
  );
}
