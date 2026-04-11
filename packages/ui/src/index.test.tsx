import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DetailGrid, RecordListPanel, StatusChip, TimelinePanel } from "./index";

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

  it("renders linked list items and timeline/detail primitives", () => {
    render(
      <div>
        <RecordListPanel
          eyebrow="Buyer records"
          title="Requests"
          description="Linked buyer request records"
          items={[
            {
              id: "request-1",
              title: "Demo paid API access",
              description: "Atlas Demo Buyer · $19.00",
              detail: "api-access",
              href: "/buyer/requests/request-1",
              hrefLabel: "Review detail",
              statusLabel: "completed",
              statusTone: "success"
            }
          ]}
          emptyTitle="No records"
          emptyDescription="No buyer records yet."
        />
        <DetailGrid
          eyebrow="Record context"
          title="Structured detail"
          description="Core facts stay visible."
          items={[
            {
              label: "Buyer organization",
              value: "Atlas Demo Buyer",
              detail: "atlas-demo-buyer"
            }
          ]}
        />
        <TimelinePanel
          eyebrow="Lifecycle"
          title="Request to evidence"
          description="Timeline-first storytelling."
          items={[
            {
              id: "timeline-1",
              label: "Request",
              title: "Demo paid API access",
              description: "Submitted by Procurement Agent",
              detail: "Apr 11, 8:00 AM",
              statusLabel: "Submitted",
              tone: "warning"
            }
          ]}
        />
      </div>
    );

    expect(screen.getByRole("link", { name: "Demo paid API access" }).getAttribute("href")).toBe(
      "/buyer/requests/request-1"
    );
    expect(screen.getByRole("link", { name: "Review detail" }).getAttribute("href")).toBe(
      "/buyer/requests/request-1"
    );
    expect(screen.getByText("Atlas Demo Buyer")).toBeTruthy();
    expect(screen.getByText("Request to evidence")).toBeTruthy();
  });
});
