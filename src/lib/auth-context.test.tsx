import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { AuthProvider, useAuth } from "./auth-context";
import { ApiError } from "./api-client";

const mocks = vi.hoisted(() => ({ api: vi.fn(), invalidate: vi.fn(), clearOffline: vi.fn().mockResolvedValue(undefined), readOffline: vi.fn().mockResolvedValue(null) }));
vi.mock("./api-client", async (original) => ({ ...await original<typeof import("./api-client")>(), apiRequest: mocks.api, invalidateApiRequests: mocks.invalidate }));
vi.mock("./offline-shopping", () => ({ clearOfflineShopping: mocks.clearOffline, readOfflineShopping: mocks.readOffline }));
const session = { user: { id: "u1", email: "cook@example.test", name: "Cook", emailVerified: true }, session: { id: "s1", expiresAt: "2030-01-01T00:00:00Z" } };
const household = { id: "h1", name: "The Kitchen", role: "owner" };

function Probe() {
  const auth = useAuth();
  const [result, setResult] = useState("");
  return <>
    <span data-testid="loading">{String(auth.loading)}</span>
    <span data-testid="error">{auth.error ?? "none"}</span>
    <span data-testid="user">{auth.user?.email ?? "none"}</span>
    <span data-testid="household">{auth.household?.name ?? "none"}</span>
    <span data-testid="result">{result}</span>
    <button onClick={async () => setResult((await auth.signIn(" cook@example.test ", "password")).error ?? "ok")}>signin</button>
    <button onClick={() => auth.signOut()}>signout</button>
    <button onClick={async () => setResult((await auth.joinHousehold(" abcd1234 ")).error ?? "ok")}>join</button>
    <button onClick={async () => setResult((await auth.requestPasswordReset("cook@example.test")).error ?? "ok")}>recover</button>
    <button onClick={async () => setResult((await auth.startGuest()).error ?? "ok")}>guest</button>
    <button onClick={async () => setResult(JSON.stringify(await auth.recoverGuest("PPG-old")))}>recoverguest</button>
    <button onClick={async () => setResult(JSON.stringify(await auth.rotateGuestRecovery()))}>rotateguest</button>
  </>;
}
function renderAuth() { return render(<AuthProvider><Probe /></AuthProvider>); }
const settled = () => waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

beforeEach(() => {
  mocks.api.mockReset().mockImplementation(async (path: string) => path === "/api/auth/get-session" ? null : path === "/api/households" ? { data: [household] } : {});
  mocks.invalidate.mockClear();
  mocks.clearOffline.mockClear();
  mocks.readOffline.mockReset().mockResolvedValue(null);
});

describe("AuthProvider", () => {
  it("loads a cookie session and server-authorized household", async () => {
    mocks.api.mockImplementation(async (path: string) => path === "/api/auth/get-session" ? session : { data: [household] });
    renderAuth();
    await settled();
    expect(screen.getByTestId("user")).toHaveTextContent("cook@example.test");
    expect(screen.getByTestId("household")).toHaveTextContent("The Kitchen");
  });

  it("settles a failed initial request without fabricating an offline session", async () => {
    mocks.api.mockRejectedValue(new Error("Network is unavailable"));
    renderAuth();
    await settled();
    expect(screen.getByTestId("error")).toHaveTextContent("Network is unavailable");
    expect(screen.getByTestId("user")).toHaveTextContent("none");
    expect(mocks.clearOffline).not.toHaveBeenCalled();
  });

  it("does not treat a household loading failure as successful onboarding", async () => {
    mocks.api.mockImplementation(async (path: string) => {
      if (path === "/api/auth/get-session") return session;
      throw new Error("Membership service unavailable");
    });
    renderAuth();
    await settled();
    expect(screen.getByTestId("error")).toHaveTextContent("Membership service unavailable");
    expect(screen.getByTestId("household")).toHaveTextContent("none");
    expect(mocks.clearOffline).not.toHaveBeenCalled();
  });

  it("signs in through the API and refreshes the authorized session", async () => {
    renderAuth();
    await settled();
    mocks.api.mockImplementation(async (path: string) => path === "/api/auth/get-session" ? session : path === "/api/households" ? { data: [household] } : {});
    await userEvent.click(screen.getByText("signin"));
    await waitFor(() => expect(screen.getByTestId("result")).toHaveTextContent("ok"));
    expect(mocks.api).toHaveBeenCalledWith("/api/auth/sign-in/email", expect.objectContaining({ method: "POST", body: { email: "cook@example.test", password: "password" } }));
    expect(screen.getByTestId("household")).toHaveTextContent("The Kitchen");
  });

  it("surfaces verification-required errors without creating a session", async () => {
    renderAuth();
    await settled();
    mocks.api.mockRejectedValue(new ApiError("Verify your email", 403, "EMAIL_NOT_VERIFIED"));
    await userEvent.click(screen.getByText("signin"));
    expect(screen.getByTestId("result")).toHaveTextContent("Verify your email");
    expect(screen.getByTestId("user")).toHaveTextContent("none");
  });

  it("explains when cookies do not establish a session after valid credentials", async () => {
    renderAuth();
    await settled();
    await userEvent.click(screen.getByText("signin"));
    expect(screen.getByTestId("result")).toHaveTextContent("Enable cookies");
    expect(screen.getByTestId("user")).toHaveTextContent("none");
  });

  it("prevents a slow pre-signout response from restoring the session", async () => {
    let resolveSession!: (value: unknown) => void;
    mocks.api.mockImplementation((path: string) => path === "/api/auth/get-session" ? new Promise((resolve) => { resolveSession = resolve; }) : Promise.resolve({}));
    renderAuth();
    await userEvent.click(screen.getByText("signout"));
    await act(async () => { resolveSession(session); });
    expect(screen.getByTestId("user")).toHaveTextContent("none");
    expect(screen.getByTestId("household")).toHaveTextContent("none");
    expect(mocks.invalidate).toHaveBeenCalled();
  });

  it("clears revoked sessions when the tab resumes", async () => {
    mocks.api.mockImplementation(async (path: string) => path === "/api/auth/get-session" ? session : { data: [household] });
    renderAuth();
    await settled();
    mocks.api.mockResolvedValue(null);
    act(() => window.dispatchEvent(new Event("focus")));
    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("none"));
    expect(screen.getByTestId("household")).toHaveTextContent("none");
  });

  it("reports failed server signout rather than claiming the cookie was revoked", async () => {
    mocks.api.mockImplementation(async (path: string) => path === "/api/auth/get-session" ? session : { data: [household] });
    renderAuth();
    await settled();
    mocks.api.mockRejectedValue(new Error("Network is unavailable"));
    await userEvent.click(screen.getByText("signout"));
    expect(screen.getByTestId("error")).toHaveTextContent("Sign out failed");
    expect(screen.getByTestId("user")).toHaveTextContent("cook@example.test");
  });

  it("joins only through the authenticated invite redemption endpoint", async () => {
    mocks.api.mockImplementation(async (path: string) => path === "/api/auth/get-session" ? session : path === "/api/households" ? { data: [] } : { data: household });
    renderAuth();
    await settled();
    await userEvent.click(screen.getByText("join"));
    expect(mocks.api).toHaveBeenCalledWith("/api/invites/redeem", expect.objectContaining({ method: "POST", body: { code: "ABCD1234" } }));
    expect(screen.getByTestId("household")).toHaveTextContent("The Kitchen");
  });

  it("starts a guest using the cookie session and authoritative household lookup", async () => {
    renderAuth();
    await settled();
    const guest = { ...session, user: { ...session.user, emailVerified: false, isAnonymous: true } };
    mocks.api.mockImplementation(async (path: string) => path === "/api/auth/get-session" ? guest : path === "/api/households" ? { data: [] } : {});
    await userEvent.click(screen.getByText("guest"));
    await waitFor(() => expect(screen.getByTestId("result")).toHaveTextContent("ok"));
    expect(mocks.api).toHaveBeenCalledWith("/api/auth/sign-in/anonymous", expect.objectContaining({ method: "POST", body: {}, identityScoped: false }));
    expect(screen.getByTestId("household")).toHaveTextContent("none");
  });

  it("retains an already-issued replacement code when session refresh fails", async () => {
    renderAuth();
    await settled();
    mocks.api.mockImplementation(async (path: string) => {
      if (path === "/api/auth/guest/recover") return { recoveryCode: "PPG-replacement" };
      throw new Error("Connection interrupted");
    });
    await userEvent.click(screen.getByText("recoverguest"));
    expect(screen.getByTestId("result")).toHaveTextContent('"recoveryCode":"PPG-replacement"');
    expect(screen.getByTestId("result")).toHaveTextContent("Connection interrupted");
    expect(mocks.api).toHaveBeenCalledWith("/api/auth/guest/recover", expect.objectContaining({ body: { code: "PPG-old" }, identityScoped: false }));
    expect(Object.values(localStorage)).not.toContain("PPG-replacement");
  });

  it("does not ask the server for a guest recovery code from a registered account", async () => {
    mocks.api.mockImplementation(async (path: string) => path === "/api/auth/get-session" ? session : { data: [household] });
    renderAuth();
    await settled();
    await userEvent.click(screen.getByText("rotateguest"));
    expect(screen.getByTestId("result")).toHaveTextContent("only available for guest accounts");
    expect(mocks.api).not.toHaveBeenCalledWith("/api/auth/guest/recovery-code", expect.anything());
  });

  it("useAuth throws outside the provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/AuthProvider/);
    spy.mockRestore();
  });
});
