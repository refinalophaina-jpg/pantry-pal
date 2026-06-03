import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import {
  Button,
  Badge,
  Card,
  Input,
  Select,
  EmptyState,
  Modal,
  Skeleton,
} from "@/components/ui";

expect.extend(toHaveNoViolations);

describe("accessibility (axe) — design-system primitives", () => {
  it("buttons, badges, and cards have no violations", async () => {
    const { container } = render(
      <main>
        <h1>Pantry</h1>
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="danger">Delete</Button>
        <div>
          <Badge tone="fresh">fresh</Badge>
          <Badge tone="expired">expired</Badge>
        </div>
        <Card>
          <h2>Card title</h2>
          <p>Some content.</p>
        </Card>
        <Skeleton className="h-4 w-20" />
      </main>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("labeled form controls have no violations", async () => {
    const { container } = render(
      <main>
        <label htmlFor="q">Search</label>
        <Input id="q" placeholder="Search…" />
        <label htmlFor="z">Zone</label>
        <Select id="z" defaultValue="pantry">
          <option value="pantry">Pantry</option>
          <option value="fridge">Fridge</option>
        </Select>
        {/* aria-label is also an acceptable accessible name */}
        <Input aria-label="Quantity" type="number" defaultValue={1} />
      </main>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("EmptyState (decorative illustration) has no violations", async () => {
    const { container } = render(
      <main>
        <EmptyState
          title="Your pantry is empty"
          description="Add your first item."
          illustration="/illustrations/empty-pantry.svg"
          action={<Button>Add item</Button>}
        />
      </main>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("open Modal has no violations", async () => {
    const { container } = render(
      <Modal open onClose={() => {}} title="Add item">
        <label htmlFor="n">Name</label>
        <Input id="n" />
        <Button>Save</Button>
      </Modal>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
