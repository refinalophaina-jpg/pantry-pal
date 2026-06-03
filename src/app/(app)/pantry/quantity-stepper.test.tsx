import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { QuantityStepper } from "./page";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("QuantityStepper", () => {
  it("renders the quantity and unit", () => {
    render(<QuantityStepper quantity={3} unit="cup" onChange={() => {}} />);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("cup")).toBeInTheDocument();
  });

  it("increments optimistically and commits after the debounce", () => {
    const onChange = vi.fn();
    render(<QuantityStepper quantity={2} unit="pcs" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Increase quantity"));
    // display updates immediately
    expect(screen.getByText("3")).toBeInTheDocument();
    // but the write is debounced
    expect(onChange).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(500));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it("coalesces rapid taps into a single commit", () => {
    const onChange = vi.fn();
    render(<QuantityStepper quantity={1} unit="pcs" onChange={onChange} />);
    const inc = screen.getByLabelText("Increase quantity");
    fireEvent.click(inc);
    fireEvent.click(inc);
    fireEvent.click(inc);
    expect(screen.getByText("4")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(500));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it("won't go below zero (decrease disabled at 0)", () => {
    const onChange = vi.fn();
    render(<QuantityStepper quantity={1} unit="pcs" onChange={onChange} />);
    const dec = screen.getByLabelText("Decrease quantity");
    fireEvent.click(dec); // 1 -> 0
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(dec).toBeDisabled();
    act(() => vi.advanceTimersByTime(500));
    expect(onChange).toHaveBeenCalledWith(0);
  });
});
