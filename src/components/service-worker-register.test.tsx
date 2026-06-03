import { describe, it, expect, vi, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { ServiceWorkerRegister } from "./service-worker-register";

afterEach(() => {
  vi.unstubAllGlobals();
  // drop any serviceWorker override we added
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: undefined,
  });
});

describe("ServiceWorkerRegister (janitor)", () => {
  it("unregisters existing service workers and clears caches on mount", async () => {
    const unregister = vi.fn().mockResolvedValue(true);
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        getRegistrations: vi.fn().mockResolvedValue([{ unregister }, { unregister }]),
      },
    });
    const del = vi.fn().mockResolvedValue(true);
    vi.stubGlobal("caches", {
      keys: vi.fn().mockResolvedValue(["v1", "v2"]),
      delete: del,
    });

    const { container } = render(<ServiceWorkerRegister />);
    expect(container).toBeEmptyDOMElement(); // renders nothing

    await waitFor(() => expect(unregister).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(del).toHaveBeenCalledTimes(2));
  });

  it("no-ops when service workers are unavailable", () => {
    // Simulate an environment with no SW support: the property is absent.
    delete (navigator as { serviceWorker?: unknown }).serviceWorker;
    const { container } = render(<ServiceWorkerRegister />);
    expect(container).toBeEmptyDOMElement();
    expect("serviceWorker" in navigator).toBe(false);
  });
});
