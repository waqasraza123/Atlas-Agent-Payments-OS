export type WorkflowFeedbackTone = "default" | "warning" | "error";

export type WorkflowFeedback = {
  title: string;
  description: string;
  tone: WorkflowFeedbackTone;
};

export function buildWorkflowFeedbackHref(
  path: string,
  title: string,
  description: string,
  tone: WorkflowFeedbackTone = "default"
) {
  const url = new URL(path, "http://atlas.local");
  url.searchParams.set("feedbackTitle", title);
  url.searchParams.set("feedbackDescription", description);
  url.searchParams.set("feedbackTone", tone);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

function readSingleSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function readWorkflowFeedback(
  searchParams: Record<string, string | string[] | undefined>
): WorkflowFeedback | null {
  const title = readSingleSearchParam(searchParams.feedbackTitle)?.trim() ?? "";
  const description = readSingleSearchParam(searchParams.feedbackDescription)?.trim() ?? "";

  if (title.length === 0 || description.length === 0) {
    return null;
  }

  const tone = readSingleSearchParam(searchParams.feedbackTone);

  return {
    title,
    description,
    tone: tone === "error" || tone === "warning" ? tone : "default"
  };
}
