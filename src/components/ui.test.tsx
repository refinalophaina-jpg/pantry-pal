import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button, Badge, Card, Input, EmptyState, Modal, Skeleton } from "./ui";

describe("Button", () => {
  it("renders children as a button and fires onClick", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    const btn = screen.getByRole("button", { name: "Save" });
    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("primary variant uses the accent token", () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole("button").className).toContain("var(--accent)");
  });

  it("danger variant uses the danger token", () => {
    render(<Button variant="danger">Delete</Button>);
    expect(screen.getByRole("button").className).toContain("var(--danger");
  });

  it("respects the disabled attribute", () => {
    render(<Button disabled>Nope</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});

describe("Badge", () => {
  it("fresh tone reads as moss (fresh token), not coral accent", () => {
    render(<Badge tone="fresh">3d left</Badge>);
    const el = screen.getByText("3d left");
    expect(el.className).toContain("var(--fresh-soft)");
    expect(el.className).toContain("var(--fresh)");
    expect(el.className).not.toContain("var(--accent-soft)");
  });

  it("expired tone uses the danger token", () => {
    render(<Badge tone="expired">Expired</Badge>);
    expect(screen.getByText("Expired").className).toContain("var(--danger");
  });
});

describe("Skeleton", () => {
  it("renders a decorative shimmer block", () => {
    const { container } = render(<Skeleton className="h-4 w-1/2" />);
    const el = container.querySelector(".skeleton");
    expect(el).not.toBeNull();
    expect(el).toHaveClass("h-4", "w-1/2");
    expect(el).toHaveAttribute("aria-hidden", "true");
  });
});

describe("Card / Input", () => {
  it("Card renders its children", () => {
    render(<Card>inside</Card>);
    expect(screen.getByText("inside")).toBeInTheDocument();
  });

  it("Input forwards props and is editable", async () => {
    render(<Input placeholder="email" />);
    const input = screen.getByPlaceholderText("email");
    await userEvent.type(input, "a@b.co");
    expect(input).toHaveValue("a@b.co");
  });
});

describe("EmptyState", () => {
  it("shows title, description, action, and a decorative illustration", () => {
    render(
      <EmptyState
        title="Nothing here"
        description="Add your first item"
        illustration="/illustrations/empty-pantry.svg"
        action={<button>Add</button>}
      />,
    );
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
    expect(screen.getByText("Add your first item")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
    const img = document.querySelector("img");
    expect(img).toHaveAttribute("src", "/illustrations/empty-pantry.svg");
    // Decorative: empty alt so screen readers skip it.
    expect(img).toHaveAttribute("alt", "");
  });
});

describe("Modal", () => {
  it("renders nothing when closed", () => {
    render(
      <Modal open={false} onClose={() => {}} title="Hidden">
        body
      </Modal>,
    );
    expect(screen.queryByText("Hidden")).not.toBeInTheDocument();
  });

  it("shows title + children when open and closes on backdrop click", async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Add item">
        <p>form</p>
      </Modal>,
    );
    expect(screen.getByText("Add item")).toBeInTheDocument();
    expect(screen.getByText("form")).toBeInTheDocument();
    // Clicking the body content should NOT close (stopPropagation).
    await userEvent.click(screen.getByText("form"));
    expect(onClose).not.toHaveBeenCalled();
  });
});
