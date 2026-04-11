import type { OrganizationKind } from "@atlas/types";
import type { SidebarNavItem } from "@atlas/ui";

export type AtlasWorkspaceDefinition = {
  workspace: OrganizationKind;
  title: string;
  subtitle: string;
  description: string;
  path: string;
  sections: SidebarNavItem[];
};

export const atlasWorkspaceDefinitions: Record<OrganizationKind, AtlasWorkspaceDefinition> = {
  BUYER: {
    workspace: "BUYER",
    title: "Buyer workspace",
    subtitle: "Controlled autonomy",
    description:
      "Buyer teams define who can spend, under which policies, and how requests are reviewed before money moves.",
    path: "/buyer",
    sections: [
      {
        href: "/buyer#overview",
        label: "Overview",
        description: "Track agent spend posture, policies, and recent request activity.",
        current: true
      },
      {
        href: "/buyer#context",
        label: "Actor context",
        description: "Review the active local development session and workspace identity."
      },
      {
        href: "/buyer#activity",
        label: "Recent lifecycle",
        description: "Inspect the latest request, approval, and receipt state for the buyer org."
      }
    ]
  },
  SELLER: {
    workspace: "SELLER",
    title: "Seller workspace",
    subtitle: "Programmable services",
    description:
      "Seller teams expose payable digital services, monitor inbound requests, and confirm delivery with durable evidence.",
    path: "/seller",
    sections: [
      {
        href: "/seller#overview",
        label: "Overview",
        description: "Monitor inbound request flow, captured payments, and buyer relationships.",
        current: true
      },
      {
        href: "/seller#context",
        label: "Actor context",
        description: "Review the active local development session and seller identity."
      },
      {
        href: "/seller#activity",
        label: "Recent lifecycle",
        description: "Inspect recent buyer requests and the payout-facing evidence trail."
      }
    ]
  },
  OPERATOR: {
    workspace: "OPERATOR",
    title: "Operator workspace",
    subtitle: "Trust and oversight",
    description:
      "Operator teams review platform-wide activity, inspect audit signals, and investigate failures before wider rollout.",
    path: "/operator",
    sections: [
      {
        href: "/operator#overview",
        label: "Overview",
        description: "Track organizations, approvals, and failure signals across the control plane.",
        current: true
      },
      {
        href: "/operator#context",
        label: "Actor context",
        description: "Review the active operator session and the support-safe identity boundary."
      },
      {
        href: "/operator#activity",
        label: "Recent lifecycle",
        description: "Inspect audit-heavy activity and unresolved operational pressure points."
      }
    ]
  }
};
