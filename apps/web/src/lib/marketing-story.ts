import { createAtlasSeedManifest, atlasSeedSpendRequests } from "@atlas/database";
import { listAtlasQueueDefinitions, listAtlasWorkspaceDefinitions } from "@atlas/domain";

export type MarketingHeroMetric = {
  label: string;
  value: string;
  detail: string;
};

export type MarketingValueCard = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
};

export type MarketingFlowStep = {
  id: string;
  title: string;
  description: string;
  detail: string;
};

export type MarketingWorkspacePreview = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  href: string;
  detail: string;
};

export type MarketingStoryModel = {
  heroMetrics: MarketingHeroMetric[];
  trustPillars: MarketingValueCard[];
  workflow: MarketingFlowStep[];
  workspacePreviews: MarketingWorkspacePreview[];
  narrativeHighlights: MarketingValueCard[];
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatCurrencyMinor(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value / 100);
}

export function createMarketingStoryModel(): MarketingStoryModel {
  const manifest = createAtlasSeedManifest();
  const successfulRequestValueMinor = atlasSeedSpendRequests
    .filter((request) => request.status === "COMPLETED")
    .reduce((total, request) => total + request.amountMinor, 0);
  const queueFamilies = new Set(listAtlasQueueDefinitions().map((queue) => queue.family));
  const workspacePreviews = listAtlasWorkspaceDefinitions().map((workspace) => ({
    id: workspace.workspace.toLowerCase(),
    title: workspace.title,
    subtitle: workspace.subtitle,
    description: workspace.description,
    href: workspace.rootHref,
    detail: `${workspace.surfaces.length} seeded surfaces`
  }));

  return {
    heroMetrics: [
      {
        label: "Seeded lifecycle states",
        value: formatNumber(manifest.requestStatusesCovered.length),
        detail: "Draft through completed, failed, rejected, and canceled paths already exist in repo-backed seed data."
      },
      {
        label: "Demo payment volume",
        value: formatCurrencyMinor(successfulRequestValueMinor),
        detail: "Completed seeded spend already spans multiple buyer and seller relationships."
      },
      {
        label: "Queue families",
        value: formatNumber(queueFamilies.size),
        detail: "Approvals, notifications, payments, seller webhooks, and audit projections are already structured."
      },
      {
        label: "Workspace surfaces",
        value: formatNumber(workspacePreviews.reduce((total, workspace) => total + Number.parseInt(workspace.detail, 10), 0)),
        detail: "Buyer, seller, and operator routes already map to durable application surfaces."
      }
    ],
    trustPillars: [
      {
        id: "policy",
        eyebrow: "Bounded authority",
        title: "Policies decide what agents can spend before money ever moves.",
        description:
          "Atlas keeps buyer-side authority legible through workspace-scoped actors, seeded policy boundaries, and approval-ready request states."
      },
      {
        id: "payments",
        eyebrow: "Observable execution",
        title: "Requests, approvals, payments, receipts, and audit events remain separate lifecycles.",
        description:
          "The product narrative is grounded in the actual schema and queue contracts, not front-end-only demo state."
      },
      {
        id: "operations",
        eyebrow: "Operational trust",
        title: "Buyer, seller, and operator teams share one control plane with explicit boundaries.",
        description:
          "The seeded demo now mirrors the future operating model: controlled autonomy for buyers, programmable services for sellers, and oversight for operators."
      }
    ],
    workflow: [
      {
        id: "request",
        title: "Agent initiates a paid request",
        description: "A buyer-side agent asks for a paid API or digital service with purpose, amount, and seller context.",
        detail: "Seed coverage includes draft, submitted, approved, executing, completed, failed, canceled, and rejected states."
      },
      {
        id: "decision",
        title: "Atlas applies policy and approval rules",
        description: "Low-risk actions stay fast. Riskier actions become explicit approvals with durable audit history.",
        detail: "Approvals and queue families are already structured for reminders, routing, and escalation."
      },
      {
        id: "settlement",
        title: "Payment, delivery, and receipt evidence stay inspectable",
        description: "Sellers see inbound demand, operators see failures, and finance-ready evidence stays visible in one lifecycle model.",
        detail: "Payments, receipts, and audit events are already seeded and visible in the current Phase 1 baseline."
      }
    ],
    workspacePreviews,
    narrativeHighlights: [
      {
        id: "buyers",
        eyebrow: "Buyer view",
        title: "Control spend without slowing down useful agents.",
        description:
          "Buyer dashboards now surface agent inventory, policy posture, spend requests, approvals, and activity grounded in seeded lifecycle records."
      },
      {
        id: "sellers",
        eyebrow: "Seller view",
        title: "Expose paid digital services in a way agents and buyers can trust.",
        description:
          "Seller dashboards now surface inbound requests, payment posture, customer relationships, and the webhook boundary that later delivery flows will use."
      },
      {
        id: "operators",
        eyebrow: "Operator view",
        title: "See the trust surface across approvals, failures, payments, and audit events.",
        description:
          "Operator dashboards now present platform-wide organization counts, failures, transaction review, and audit-heavy seeded activity."
      }
    ]
  };
}
