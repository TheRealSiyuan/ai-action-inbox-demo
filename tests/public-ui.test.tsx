import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SuggestionCard } from "@/components/SuggestionCard";
import { SetupChecklist } from "@/components/SetupChecklist";
import { makeAction, approveForTest } from "./helpers";
import { vi } from "vitest";
describe("demo interface", () => {
  it("labels the rules-based simulation honestly", () => {
    render(<SetupChecklist />);
    expect(screen.getByText(/built-in rules/)).toBeInTheDocument();
    expect(screen.getByText(/Nothing is sent or booked/)).toBeInTheDocument();
  });
  it("offers execution only after approval and labels it simulation", async () => {
    const execute = vi.fn();
    const props = { onApprove: vi.fn(), onReject: vi.fn(), onEdit: vi.fn(), onExecute: execute, busy: false };
    const action = makeAction({ type: "create_task" });
    const view = render(<SuggestionCard {...props} action={action} />);
    expect(screen.queryByRole("button", { name: "Simulate action" })).not.toBeInTheDocument();
    view.rerender(<SuggestionCard {...props} action={approveForTest(action)} />);
    await userEvent.click(screen.getByRole("button", { name: "Simulate action" }));
    expect(execute).toHaveBeenCalledOnce();
  });
});
