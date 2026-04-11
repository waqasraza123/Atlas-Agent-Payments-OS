import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorkspaceDetailPage } from "./workspace-detail-page";

describe("WorkspaceDetailPage", () => {
  it("renders workflow feedback and analysis detail when provided", () => {
    render(
      <WorkspaceDetailPage
        feedback={{
          title: "Approval decision recorded",
          description: "The request lifecycle has advanced to its next state.",
          tone: "default"
        }}
        model={{
          eyebrow: "Request detail",
          title: "Premium dataset unlock",
          description: "Atlas Demo Buyer → Atlas Demo Seller",
          statusLabel: "Submitted",
          statusTone: "warning",
          metrics: [
            {
              label: "Amount",
              value: "$24.00",
              detail: "Persisted request amount."
            }
          ],
          facts: [
            {
              label: "Purpose",
              value: "Refresh the premium research dataset.",
              detail: "Buyer-supplied purpose."
            }
          ],
          analysis: {
            eyebrow: "Policy and approval posture",
            title: "Evaluation and human decision context",
            description: "Reasoning stays explicit on the request detail.",
            items: [
              {
                label: "Evaluation outcome",
                value: "Allow Requires Approval",
                detail: "The request is allowed but requires a human approval before execution."
              }
            ],
            emptyTitle: "No evaluation context available",
            emptyDescription: "Atlas will render policy reasoning here."
          },
          preview: {
            eyebrow: "Execution evidence",
            title: "Receipt and fulfillment preview",
            description: "Execution evidence stays distinct from the request.",
            items: [
              {
                label: "Decision reason",
                value: "Within buyer approval threshold",
                detail: "owner@atlas.local"
              }
            ],
            emptyTitle: "No execution evidence available",
            emptyDescription: "Atlas will show execution evidence here."
          },
          timeline: {
            eyebrow: "Lifecycle timeline",
            title: "Request to evidence narrative",
            description: "Timeline-first request detail.",
            items: [
              {
                id: "timeline-1",
                label: "Policy",
                title: "Low Risk API Access",
                description: "The request is allowed but requires a human approval before execution.",
                detail: "Apr 11, 10:00 AM",
                statusLabel: "Allow Requires Approval",
                tone: "warning"
              }
            ],
            emptyTitle: "No lifecycle timeline available",
            emptyDescription: "Atlas will render request events here."
          },
          related: {
            eyebrow: "Cross-linked records",
            title: "Related lifecycle records",
            description: "Linked approval and payment records.",
            items: [],
            emptyTitle: "No related records available",
            emptyDescription: "Linked records appear here."
          },
          demoJourney: {
            eyebrow: "Replayable demo flow",
            title: "Related seeded scenarios",
            description: "Connected lifecycle demos.",
            items: []
          }
        }}
      />
    );

    expect(screen.getByText("Approval decision recorded")).toBeTruthy();
    expect(screen.getByText("Evaluation and human decision context")).toBeTruthy();
    expect(screen.getAllByText("Allow Requires Approval")).toHaveLength(2);
  });
});
