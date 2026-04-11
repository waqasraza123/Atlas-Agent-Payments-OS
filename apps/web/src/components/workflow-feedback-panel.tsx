import { StatePanel } from "@atlas/ui";

type WorkflowFeedbackTone = "default" | "warning" | "error";

type WorkflowFeedbackPanelProps = Readonly<{
  title: string;
  description: string;
  tone?: WorkflowFeedbackTone;
}>;

export function WorkflowFeedbackPanel({
  title,
  description,
  tone = "default"
}: WorkflowFeedbackPanelProps) {
  return <StatePanel eyebrow="Workflow feedback" title={title} description={description} tone={tone} />;
}
