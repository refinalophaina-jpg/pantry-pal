import { describe, it, expect } from "vitest";
import { renderHook, act, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { useMounted } from "./use-mounted";
import { useAction } from "./use-action";
import { ToastProvider } from "@/components/toast";

const wrapper = ({ children }: { children: ReactNode }) => (
  <ToastProvider>{children}</ToastProvider>
);

describe("useMounted", () => {
  it("is true after the mount effect runs", () => {
    const { result } = renderHook(() => useMounted());
    expect(result.current).toBe(true);
  });
});

describe("useAction", () => {
  it("returns true and shows the success toast when the action resolves", async () => {
    const { result } = renderHook(() => useAction(), { wrapper });
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current(() => Promise.resolve(), { success: "Done" });
    });
    expect(ok).toBe(true);
    expect(screen.getByText("Done")).toBeInTheDocument();
  });

  it("returns false and shows a warning when the action throws", async () => {
    const { result } = renderHook(() => useAction(), { wrapper });
    let ok: boolean | undefined = true;
    await act(async () => {
      ok = await result.current(
        () => {
          throw new Error("nope");
        },
        { error: "Could not save" },
      );
    });
    expect(ok).toBe(false);
    expect(screen.getByText("Could not save")).toBeInTheDocument();
  });

  it("falls back to the error message when no custom error is given", async () => {
    const { result } = renderHook(() => useAction(), { wrapper });
    await act(async () => {
      await result.current(() => {
        throw new Error("boom from store");
      });
    });
    expect(screen.getByText("boom from store")).toBeInTheDocument();
  });
});
