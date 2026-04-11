import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecordListPanel, StatusChip } from "./index";

describe("atlas ui package", () => {
  it("renders status chip tones", () => {
    render(<StatusChip label="captured" tone="success" />);

    expect(screen.getByText("captured")).toBeTruthy();
  });

  it("renders empty and populated record list states", () => {
    const { rerender } = render(
      <RecordListPanel
        eyebrow="Queue family"
        title="Payments"
        description="Queue coverage"
        items={[]}
        emptyTitle="No records"
        emptyDescription="Seed data has not been loaded yet."
      />
    );

    expect(screen.getByText("No records")).toBeTruthy();

    rerender(
      <RecordListPanel
        eyebrow="Queue family"
        title="Payments"
        description="Queue coverage"
        items={[
          {
            id: "payment-1",
            title: "Execution queue",
            description: "Executes payment attempts",
            detail: "atlas-phase-0-payments-execution",
            statusLabel: "baseline",
            statusTone: "success"
          }
        ]}
        emptyTitle="No records"
        emptyDescription="Seed data has not been loaded yet."
      />
    );

    expect(screen.getByText("Execution queue")).toBeTruthy();
    expect(screen.getByText("baseline")).toBeTruthy();
  });
});
