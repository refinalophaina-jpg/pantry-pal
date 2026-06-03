import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sidebar, MobileNav } from "./sidebar";
import { ToastProvider } from "./toast";

const { signOut, createInvite } = vi.hoisted(() => ({
  signOut: vi.fn(),
  createInvite: vi.fn(),
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/pantry" }));
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: { email: "cook@home.test" },
    household: { id: "h1", name: "The Kitchen" },
    signOut,
    createInvite,
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
});

describe("MobileNav", () => {
  it("renders the short nav labels", () => {
    render(<MobileNav />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Learn")).toBeInTheDocument();
  });
});
