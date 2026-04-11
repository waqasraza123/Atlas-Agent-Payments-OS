import { describe, expect, it } from "vitest";
import { buildWorkflowFeedbackHref, readWorkflowFeedback } from "./workflow-feedback";

describe("workflow feedback helpers", () => {
  it("builds a feedback redirect href", () => {
    expect(
      buildWorkflowFeedbackHref("/buyer/requests/request-1", "Request submitted", "Atlas recorded the next state.")
    ).toBe(
      "/buyer/requests/request-1?feedbackTitle=Request+submitted&feedbackDescription=Atlas+recorded+the+next+state.&feedbackTone=default"
    );
  });

  it("reads feedback from search params and normalizes the tone", () => {
    expect(
      readWorkflowFeedback({
        feedbackTitle: "Approval recorded",
        feedbackDescription: "The request detail now reflects the decision.",
        feedbackTone: "warning"
      })
    ).toEqual({
      title: "Approval recorded",
      description: "The request detail now reflects the decision.",
      tone: "warning"
    });

    expect(readWorkflowFeedback({ feedbackTitle: "Missing description" })).toBeNull();
  });
});
