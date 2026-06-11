import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider, useAuth } from "./auth-context";

const h = vi.hoisted(() => ({
  auth: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  },
  household: { current: { data: null as unknown, error: null as unknown } },
}));

vi.mock("./supabase", () => ({
  getSupabase: () => ({
    auth: h.auth,
    from: () => {
      const b: Record<string, unknown> = {
        select: () => b,
        eq: () => b,
        order: () => b,
        limit: () => b,
        maybeSingle: async () => h.household.current,
      };
      return b;
    },
  }),
}));

function Probe() {
  const { loading, error, user, household, signIn, signOut } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="error">{error ?? "none"}</span>
      <span data-testid="user">{user?.email ?? "none"}</span>
      <span data-testid="household">{household?.name ?? "none"}</span>
      <button onClick={() => signIn("a@b.co", "pw")}>signin</button>
      <button onClick={() => signOut()}>signout</button>
    </div>
  );
}

function renderAuth() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

beforeEach(() => {
  h.auth.getSession.mockReset();
  h.auth.getSession.mockResolvedValue({ data: { session: null } });
  h.auth.onAuthStateChange.mockClear();
  h.auth.signInWithPassword.mockReset();
  h.auth.signUp.mockReset();
  h.auth.signOut.mockReset().mockResolvedValue({ error: null });
  h.household.current = { data: null, error: null };
});

describe("AuthProvider", () => {
  it("settles to logged-out when there is no session", async () => {
    renderAuth();
    await waitFor(() =>
      expect(screen.getByTestId("loading")).toHaveTextContent("false"),
    );
    expect(screen.getByTestId("user")).toHaveTextContent("none");
    expect(screen.getByTestId("household")).toHaveTextContent("none");
    // it subscribes to auth changes
    expect(h.auth.onAuthStateChange).toHaveBeenCalled();
  });

  it("loads the user and their household from an existing session", async () => {
    h.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: "u1", email: "cook@home.test" } } },
    });
    h.household.current = {
      data: { role: "owner", household: { id: "hh1", name: "The Kitchen" } },
      error: null,
    };
    renderAuth();
    await waitFor(() =>
      expect(screen.getByTestId("user")).toHaveTextContent("cook@home.test"),
    );
    expect(screen.getByTestId("household")).toHaveTextContent("The Kitchen");
  });

  it("settles to an error (not an infinite spinner) when the session load fails", async () => {
    h.auth.getSession.mockRejectedValue(new Error("network is down"));
    renderAuth();
    await waitFor(() =>
      expect(screen.getByTestId("loading")).toHaveTextContent("false"),
    );
    expect(screen.getByTestId("error")).toHaveTextContent("network is down");
  });

  it("signIn calls Supabase with the credentials", async () => {
    h.auth.signInWithPassword.mockResolvedValue({ error: null });
    renderAuth();
    await waitFor(() =>
      expect(screen.getByTestId("loading")).toHaveTextContent("false"),
    );
    await userEvent.click(screen.getByText("signin"));
    expect(h.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "a@b.co",
      password: "pw",
    });
  });

  it("signOut calls Supabase", async () => {
    renderAuth();
    await waitFor(() =>
      expect(screen.getByTestId("loading")).toHaveTextContent("false"),
    );
    await userEvent.click(screen.getByText("signout"));
    expect(h.auth.signOut).toHaveBeenCalled();
  });

  it("auth-change callback is synchronous and defers the household query (no auth-lock deadlock)", async () => {
    renderAuth();
    await waitFor(() =>
      expect(screen.getByTestId("loading")).toHaveTextContent("false"),
    );
    const cb = (h.auth.onAuthStateChange.mock.calls as unknown[][])[0][0] as (
      evt: string,
      sess: unknown,
    ) => unknown;
    h.household.current = {
      data: { role: "member", household: { id: "hh2", name: "Resumed Home" } },
      error: null,
    };
    let ret: unknown;
    act(() => {
      // supabase-js holds the auth lock while this runs — it must not return
      // a promise that performs Supabase work before resolving.
      ret = cb("SIGNED_IN", { user: { id: "u2", email: "back@home.test" } });
    });
    expect(ret).toBeUndefined(); // synchronous, nothing awaited in-lock
    await waitFor(() =>
      expect(screen.getByTestId("household")).toHaveTextContent("Resumed Home"),
    );
  });

  it("TOKEN_REFRESHED keeps the session but skips the household reload", async () => {
    h.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: "u1", email: "cook@home.test" } } },
    });
    h.household.current = {
      data: { role: "owner", household: { id: "hh1", name: "The Kitchen" } },
      error: null,
    };
    renderAuth();
    await waitFor(() =>
      expect(screen.getByTestId("household")).toHaveTextContent("The Kitchen"),
    );
    const cb = (h.auth.onAuthStateChange.mock.calls as unknown[][])[0][0] as (
      evt: string,
      sess: unknown,
    ) => unknown;
    // If a refresh re-queried, this poisoned result would clobber the state.
    h.household.current = { data: null, error: { message: "boom" } };
    act(() => {
      cb("TOKEN_REFRESHED", { user: { id: "u1", email: "cook@home.test" } });
    });
    // Deferred work gets a chance to run; household must remain intact.
    await new Promise((r) => setTimeout(r, 10));
    expect(screen.getByTestId("household")).toHaveTextContent("The Kitchen");
  });

  it("useAuth throws outside the provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/AuthProvider/);
    spy.mockRestore();
  });
});
