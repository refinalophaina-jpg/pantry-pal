import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sidebar, MobileNav } from "./sidebar";
import { ToastProvider } from "./toast";

const { signOut, createInvite, rotateGuestRecovery, identity } = vi.hoisted(() => ({
  signOut: vi.fn(),
  createInvite: vi.fn(),
  rotateGuestRecovery: vi.fn(),
  identity: { isAnonymous: false },
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/pantry" }));
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "cook@home.test", isAnonymous: identity.isAnonymous },
    household: { id: "h1", name: "The Kitchen" },
    signOut,
    createInvite,
    rotateGuestRecovery,
  }),
}));

function renderSidebar() {
  return render(
    <ToastProvider>
      <Sidebar />
    </ToastProvider>,
  );
}

beforeEach(() => {
  signOut.mockReset();
  createInvite.mockReset();
  rotateGuestRecovery.mockReset();
  identity.isAnonymous = false;
});

describe("Sidebar", () => {
  it("shows the brand, household name, and user email", () => {
    renderSidebar();
    expect(screen.getByText("Pantry Pal")).toBeInTheDocument();
    expect(screen.getByText("The Kitchen")).toBeInTheDocument();
    expect(screen.getByText("cook@home.test")).toBeInTheDocument();
  });

  it("renders the full navigation", () => {
    renderSidebar();
    const nav = screen.getByRole("navigation");
    for (const label of [
      "Dashboard",
      "Pantry",
      "My Recipes",
      "Explore",
      "Learn",
      "Meal Plan",
      "Shopping",
      "Analytics",
    ]) {
      expect(within(nav).getByText(label)).toBeInTheDocument();
    }
  });

  it("signs out when the button is clicked", async () => {
    renderSidebar();
    await userEvent.click(screen.getByRole("button", { name: /sign out/i }));
    expect(signOut).toHaveBeenCalledOnce();
  });

  it("opens the invite modal", async () => {
    renderSidebar();
    await userEvent.click(screen.getByRole("button", { name: /invite partner/i }));
    expect(screen.getByText(/Invite to household/i)).toBeInTheDocument();
  });

  it("the search button opens the command palette via ⌘K", async () => {
    const dispatch = vi.spyOn(document, "dispatchEvent");
    renderSidebar();
    await userEvent.click(screen.getByRole("button", { name: /search/i }));
    const sent = dispatch.mock.calls
      .map((c) => c[0])
      .find((e): e is KeyboardEvent => e instanceof KeyboardEvent);
    expect(sent?.key).toBe("k");
    expect(sent?.metaKey).toBe(true);
    dispatch.mockRestore();
  });
  it("shows a guest recovery code once without persisting it", async () => {
    identity.isAnonymous = true;
    rotateGuestRecovery.mockResolvedValue({ recoveryCode: "guest-secret-only-shown-once" });
    renderSidebar();
    expect(screen.queryByText("cook@home.test")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Guest recovery code" }));
    await userEvent.click(screen.getByRole("button", { name: "Create or replace recovery code" }));
    expect(await screen.findByLabelText("Recovery code")).toHaveTextContent("guest-secret-only-shown-once");
    expect(rotateGuestRecovery).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole("button", { name: "I saved my code" }));
    await userEvent.click(screen.getByRole("button", { name: "Guest recovery code" }));
    expect(screen.queryByText("guest-secret-only-shown-once")).not.toBeInTheDocument();
    expect(JSON.stringify(localStorage)).not.toContain("guest-secret-only-shown-once");
    expect(JSON.stringify(sessionStorage)).not.toContain("guest-secret-only-shown-once");
  });
});

describe("MobileNav", () => {
  function renderMobile() { return render(<ToastProvider><MobileNav /></ToastProvider>); }
  it("keeps four primary destinations and More on the bottom bar", () => {
    renderMobile();
    const nav = screen.getByRole("navigation", { name: "Primary mobile navigation" });
    expect(within(nav).getAllByRole("link")).toHaveLength(4);
    expect(within(nav).getByText("Home")).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: "More" })).toHaveAttribute("aria-expanded", "false");
    expect(within(nav).getByRole("link", { name: "Pantry" })).toHaveAttribute("aria-current", "page");
  });
  it("restores More after a Safari-style click that does not focus the button", async () => {
    renderMobile();
    const trigger = screen.getByRole("button", { name: "More" });
    expect(trigger).not.toHaveFocus();
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "More and account" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(trigger).toHaveFocus();
  });
  it("makes overflow routes and account controls reachable", async () => {
    renderMobile();
    await userEvent.click(screen.getByRole("button", { name: "More" }));
    const dialog = screen.getByRole("dialog", { name: "More and account" });
    for (const label of ["Explore", "Learn", "Meal Plan", "Analytics", "Saved shopping list"]) expect(within(dialog).getByRole("link", { name: label })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /switch to .* mode/i })).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Sign out" }));
    expect(signOut).toHaveBeenCalledOnce();
  });
  it("opens partner invitations from More", async () => {
    renderMobile();
    await userEvent.click(screen.getByRole("button", { name: "More" }));
    await userEvent.click(screen.getByRole("button", { name: "Invite partner" }));
    expect(screen.getByRole("dialog", { name: "Invite to household" })).toBeInTheDocument();
  });
  it("makes guest recovery reachable from More", async () => {
    identity.isAnonymous = true;
    renderMobile();
    await userEvent.click(screen.getByRole("button", { name: "More" }));
    await userEvent.click(screen.getByRole("button", { name: "Guest recovery code" }));
    expect(screen.getByRole("dialog", { name: "Guest recovery code" })).toBeInTheDocument();
  });
});
