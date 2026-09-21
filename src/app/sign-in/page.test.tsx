import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SignInPage from "./page";
const mocks = vi.hoisted(() => ({ signIn: vi.fn(), signUp: vi.fn(), recover: vi.fn(), reset: vi.fn(), verify: vi.fn(), replace: vi.fn(), guest: vi.fn(), guestRecover: vi.fn() }));
const state = vi.hoisted(() => ({ user: null as { id: string; isAnonymous: boolean } | null, household: null as { id: string } | null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ ...state, loading: false, error: null, signIn: mocks.signIn, signUp: mocks.signUp, startGuest: mocks.guest, recoverGuest: mocks.guestRecover, requestPasswordReset: mocks.recover, resetPassword: mocks.reset, resendVerification: mocks.verify }) }));
beforeEach(() => {
  for (const fn of Object.values(mocks)) fn.mockReset().mockResolvedValue({});
  window.history.replaceState(null, "", "/sign-in/");
  state.user = null;
  state.household = null;
});

describe("Sign-in account recovery", () => {
  it("submits a reset token once and removes it from the browser address", async () => {
    window.history.replaceState(null, "", "/sign-in/?token=reset-code");
    render(<SignInPage />);
    expect(await screen.findByRole("heading", { name: "Choose a new password" })).toBeVisible();
    expect(window.location.search).toBe("");
    await userEvent.type(screen.getByLabelText("New password"), "my new secure password");
    await userEvent.click(screen.getByRole("button", { name: "Save new password" }));
    expect(mocks.reset).toHaveBeenCalledWith("reset-code", "my new secure password");
    expect(await screen.findByRole("status")).toHaveTextContent("previous sessions revoked");
  });
  it("requests recovery with an account-neutral confirmation", async () => {
    render(<SignInPage />);
    await userEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    await userEvent.type(screen.getByLabelText("Email"), "cook@example.test");
    await userEvent.click(screen.getByRole("button", { name: "Send link" }));
    expect(mocks.recover).toHaveBeenCalledWith("cook@example.test");
    expect(await screen.findByRole("status")).toHaveTextContent("If an account exists");
  });
  it("surfaces email service failure instead of claiming delivery", async () => {
    mocks.verify.mockResolvedValue({ error: "Email verification is unavailable." });
    render(<SignInPage />);
    await userEvent.click(screen.getByRole("button", { name: "Resend verification email" }));
    await userEvent.type(screen.getByLabelText("Email"), "cook@example.test");
    await userEvent.click(screen.getByRole("button", { name: "Send link" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("unavailable"));
    expect(screen.queryByRole("status")).toBeNull();
  });
  it("starts a guest without asking for an email or password", async () => {
    render(<SignInPage />);
    await userEvent.click(screen.getByRole("button", { name: "Continue as guest" }));
    expect(mocks.guest).toHaveBeenCalledOnce();
    expect(mocks.signIn).not.toHaveBeenCalled();
    expect(mocks.signUp).not.toHaveBeenCalled();
  });
  it("keeps the replacement recovery code visible until explicitly saved", async () => {
    const replacement = "PPG-replacement-secret";
    mocks.guestRecover.mockImplementation(async () => {
      state.user = { id: "guest-1", isAnonymous: true };
      state.household = { id: "home-1" };
      return { recoveryCode: replacement };
    });
    render(<SignInPage />);
    await userEvent.click(screen.getByRole("button", { name: "Recover a guest account" }));
    await userEvent.type(screen.getByLabelText("Guest recovery code"), "PPG-old-code");
    await userEvent.click(screen.getByRole("button", { name: "Recover guest account" }));
    expect(mocks.guestRecover).toHaveBeenCalledWith("PPG-old-code");
    expect(await screen.findByLabelText("New guest recovery code")).toHaveValue(replacement);
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(window.location.href).not.toContain(replacement);
    expect(Object.values(localStorage)).not.toContain(replacement);
    await userEvent.click(screen.getByRole("button", { name: "I've saved my recovery code" }));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/"));
  });
  it("shows an issued replacement even if refreshing the recovered session fails", async () => {
    mocks.guestRecover.mockResolvedValue({ recoveryCode: "PPG-keep-this", error: "Network is unavailable" });
    render(<SignInPage />);
    await userEvent.click(screen.getByRole("button", { name: "Recover a guest account" }));
    await userEvent.type(screen.getByLabelText("Guest recovery code"), "PPG-old-code");
    await userEvent.click(screen.getByRole("button", { name: "Recover guest account" }));
    expect(await screen.findByLabelText("New guest recovery code")).toHaveValue("PPG-keep-this");
    expect(screen.getByRole("alert")).toHaveTextContent("replacement code is still valid");
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
