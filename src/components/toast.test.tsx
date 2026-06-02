import { describe, it, expect, vi } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider, useToast } from "./toast";

function Trigger({ kind }: { kind?: "success" | "info" | "warn" }) {
  const { toast } = useToast();
  return <button onClick={() => toast("Saved!", kind)}>fire</button>;
}

describe("ToastProvider / useToast", () => {
  it("shows a toast on demand and dismisses it on click", async () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByText("fire"));
    expect(screen.getByText("Saved!")).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("Dismiss"));
    expect(screen.queryByText("Saved!")).not.toBeInTheDocument();
  });

  it("auto-dismisses after the timeout", () => {
    vi.useFakeTimers();
    try {
      render(
        <ToastProvider>
          <Trigger />
        </ToastProvider>,
      );
      fireEvent.click(screen.getByText("fire"));
      expect(screen.getByText("Saved!")).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(3300);
      });
      expect(screen.queryByText("Saved!")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("throws when used outside a provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Trigger />)).toThrow(/ToastProvider/);
    spy.mockRestore();
  });
});
