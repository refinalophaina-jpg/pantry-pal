import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ServiceWorkerRegister } from "./service-worker-register";

beforeEach(() => vi.stubEnv("NODE_ENV", "production"));
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  delete (navigator as { serviceWorker?: unknown }).serviceWorker;
});

function browser(waiting: { postMessage: ReturnType<typeof vi.fn> } | null = null) {
  const registration = Object.assign(new EventTarget(), { waiting, installing: null as (EventTarget & { state: string }) | null });
  const serviceWorker = Object.assign(new EventTarget(), { controller: {}, register: vi.fn().mockResolvedValue(registration) });
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: serviceWorker });
  return { registration, serviceWorker };
}

describe("Service worker updates", () => {
  it("registers the production worker with a fresh script check", async () => {
    const { serviceWorker } = browser();
    const { container } = render(<ServiceWorkerRegister />);
    await waitFor(() => expect(serviceWorker.register).toHaveBeenCalledWith("/sw.js", { scope: "/", updateViaCache: "none" }));
    expect(container).toBeEmptyDOMElement();
  });

  it("leaves a waiting update inactive until the user applies it", async () => {
    const waiting = { postMessage: vi.fn() };
    browser(waiting);
    render(<ServiceWorkerRegister />);
    expect(await screen.findByRole("status")).toHaveTextContent("Finish any edits");
    expect(waiting.postMessage).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Reload and update" }));
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: "APPLY_UPDATE" });
  });

  it("can postpone the update without activating it", async () => {
    const waiting = { postMessage: vi.fn() };
    browser(waiting);
    render(<ServiceWorkerRegister />);
    await userEvent.click(await screen.findByRole("button", { name: "Later" }));
    expect(waiting.postMessage).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("notifies when a newer worker finishes installing", async () => {
    const { registration } = browser();
    render(<ServiceWorkerRegister />);
    await act(async () => {});
    const installing = Object.assign(new EventTarget(), { state: "installing" });
    act(() => { registration.installing = installing; registration.dispatchEvent(new Event("updatefound")); });
    act(() => {
      registration.waiting = { postMessage: vi.fn() };
      installing.state = "installed";
      installing.dispatchEvent(new Event("statechange"));
    });
    expect(await screen.findByRole("status")).toHaveTextContent("An update is ready");
  });

  it("does not register during development or when unsupported", () => {
    vi.stubEnv("NODE_ENV", "development");
    const { serviceWorker } = browser();
    const { unmount } = render(<ServiceWorkerRegister />);
    expect(serviceWorker.register).not.toHaveBeenCalled();
    unmount();
    delete (navigator as { serviceWorker?: unknown }).serviceWorker;
    vi.stubEnv("NODE_ENV", "production");
    expect(render(<ServiceWorkerRegister />).container).toBeEmptyDOMElement();
  });
});
