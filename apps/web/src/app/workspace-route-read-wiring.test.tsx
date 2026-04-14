import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listBuyerAgentsForActor: vi.fn(),
  listBuyerPoliciesForActor: vi.fn(),
  listBuyerApprovalsForActor: vi.fn(),
  listBuyerRequestAnalyticsForActor: vi.fn(),
  getSellerProfileForActor: vi.fn(),
  getSellerAnalyticsForActor: vi.fn(),
  listSellerTeamMembersForActor: vi.fn(),
  listSellerServicesForActor: vi.fn(),
  listSellerRequestsForActor: vi.fn(),
  listSellerRequestAnalyticsForActor: vi.fn(),
  findMany: vi.fn(),
  resolveWorkspaceActor: vi.fn(),
  createBuyerAgentAction: vi.fn(),
  updateBuyerAgentAction: vi.fn(),
  createBuyerPolicyAction: vi.fn(),
  updateBuyerPolicyAction: vi.fn(),
  createBuyerRequestAction: vi.fn(),
  decideBuyerApprovalAction: vi.fn(),
  createSellerServiceAction: vi.fn(),
  updateSellerServiceAction: vi.fn()
}));

vi.mock("@atlas/database", () => ({
  listBuyerAgentsForActor: mocks.listBuyerAgentsForActor,
  listBuyerPoliciesForActor: mocks.listBuyerPoliciesForActor,
  listBuyerApprovalsForActor: mocks.listBuyerApprovalsForActor,
  listBuyerRequestAnalyticsForActor: mocks.listBuyerRequestAnalyticsForActor,
  getSellerProfileForActor: mocks.getSellerProfileForActor,
  getSellerAnalyticsForActor: mocks.getSellerAnalyticsForActor,
  listSellerTeamMembersForActor: mocks.listSellerTeamMembersForActor,
  listSellerServicesForActor: mocks.listSellerServicesForActor,
  listSellerRequestsForActor: mocks.listSellerRequestsForActor,
  listSellerRequestAnalyticsForActor: mocks.listSellerRequestAnalyticsForActor,
  prisma: {
    organization: {
      findMany: mocks.findMany
    }
  }
}));

vi.mock("@/lib/server/actor-context", () => ({
  resolveWorkspaceActor: mocks.resolveWorkspaceActor
}));

vi.mock("./(buyer)/buyer/actions", () => ({
  createBuyerAgentAction: mocks.createBuyerAgentAction,
  updateBuyerAgentAction: mocks.updateBuyerAgentAction,
  createBuyerPolicyAction: mocks.createBuyerPolicyAction,
  updateBuyerPolicyAction: mocks.updateBuyerPolicyAction,
  createBuyerRequestAction: mocks.createBuyerRequestAction,
  decideBuyerApprovalAction: mocks.decideBuyerApprovalAction
}));

vi.mock("./(seller)/seller/actions", () => ({
  createSellerServiceAction: mocks.createSellerServiceAction,
  updateSellerServiceAction: mocks.updateSellerServiceAction
}));

import BuyerAgentsPage from "./(buyer)/buyer/agents/page";
import BuyerApprovalsPage from "./(buyer)/buyer/approvals/page";
import BuyerPoliciesPage from "./(buyer)/buyer/policies/page";
import BuyerRequestsPage from "./(buyer)/buyer/requests/page";
import SellerPage from "./(seller)/seller/page";
import SellerRequestsPage from "./(seller)/seller/requests/page";
import SellerServicesPage from "./(seller)/seller/services/page";

const buyerActor = {
  workspace: "BUYER",
  source: "app",
  organization: {
    id: "buyer-org",
    kind: "BUYER"
  }
};

const sellerActor = {
  workspace: "SELLER",
  source: "app",
  organization: {
    id: "seller-org",
    kind: "SELLER"
  }
};

describe("workspace route read wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveWorkspaceActor.mockImplementation(async (workspace: string) => ({
      status: "ready",
      actor: workspace === "BUYER" ? buyerActor : sellerActor
    }));
    mocks.listBuyerAgentsForActor.mockResolvedValue([
      {
        id: "agent-1",
        name: "Agent 1",
        purpose: "Purpose",
        requestCount: 1,
        policyName: "Policy 1",
        policyId: "policy-1",
        externalRef: null,
        status: "ACTIVE"
      }
    ]);
    mocks.listBuyerPoliciesForActor.mockResolvedValue([
      {
        id: "policy-1",
        name: "Policy 1",
        linkedAgentCount: 1,
        requestCount: 1,
        version: 1,
        status: "ACTIVE",
        rules: {
          sellerAllowlist: [],
          serviceAllowlist: [],
          serviceCategories: [],
          maxAmountMinor: 5000,
          autoApprovalThresholdMinor: 2500,
          escalationThresholdMinor: 10000,
          emergencyStop: false
        }
      }
    ]);
    mocks.listBuyerApprovalsForActor.mockResolvedValue([
      {
        id: "approval-1",
        requestTitle: "Request 1",
        amountMinor: 2400,
        currency: "USD",
        serviceCategory: "api-access",
        decisionReason: null,
        status: "PENDING"
      }
    ]);
    mocks.listBuyerRequestAnalyticsForActor.mockResolvedValue([
      {
        id: "request-1",
        title: "Request 1",
        amountMinor: 2400,
        currency: "USD",
        serviceCategory: "api-access",
        purpose: "Purpose",
        agentName: "Agent 1",
        sellerOrganizationName: "Seller 1",
        reconciliationState: "pending",
        requestStatus: "SUBMITTED",
        approvalStatus: null
      }
    ]);
    mocks.findMany.mockResolvedValue([
      {
        id: "seller-1",
        name: "Seller 1"
      }
    ]);
    mocks.getSellerProfileForActor.mockResolvedValue({
      organizationId: "seller-org",
      organizationName: "Seller Org",
      organizationSlug: "seller-org",
      serviceCount: 1,
      publishedServiceCount: 1,
      requestCount: 1,
      activeBuyerCount: 1
    });
    mocks.getSellerAnalyticsForActor.mockResolvedValue({
      pendingFulfillmentCount: 1,
      completedRequestCount: 1,
      failedRequestCount: 0,
      unmatchedRequestCount: 0,
      topServices: [],
      topBuyers: []
    });
    mocks.listSellerTeamMembersForActor.mockResolvedValue([
      {
        membershipId: "membership-1",
        userName: "Seller User",
        userEmail: "seller@example.com",
        role: "OWNER"
      }
    ]);
    mocks.listSellerServicesForActor.mockResolvedValue([
      {
        id: "service-1",
        key: "service-key",
        name: "Service 1",
        description: "Description",
        category: "api-access",
        priceMinor: 2400,
        currency: "USD",
        visibility: "PRIVATE",
        pricingModel: "FIXED",
        status: "PUBLISHED",
        linkedRequestCount: 1
      }
    ]);
    mocks.listSellerRequestsForActor.mockResolvedValue([
      {
        id: "seller-request-1",
        title: "Seller Request 1",
        buyerOrganizationName: "Buyer Org",
        amountMinor: 2400,
        currency: "USD",
        serviceCategory: "api-access",
        matchedServiceName: "Service 1",
        serviceKey: "service-key",
        status: "APPROVED",
        fulfillment: null
      }
    ]);
    mocks.listSellerRequestAnalyticsForActor.mockResolvedValue([
      {
        id: "seller-request-1",
        title: "Seller Request 1",
        buyerOrganizationName: "Buyer Org",
        amountMinor: 2400,
        currency: "USD",
        serviceCategory: "api-access",
        matchedServiceName: "Service 1",
        serviceKey: "service-key",
        reconciliationState: "healthy",
        requestStatus: "APPROVED"
      }
    ]);
  });

  it("routes buyer pages through actor-aware read wrappers", async () => {
    await BuyerAgentsPage({ searchParams: Promise.resolve({}) });
    await BuyerPoliciesPage({ searchParams: Promise.resolve({}) });
    await BuyerRequestsPage({ searchParams: Promise.resolve({}) });
    await BuyerApprovalsPage({ searchParams: Promise.resolve({}) });

    expect(mocks.listBuyerAgentsForActor).toHaveBeenCalledWith(buyerActor);
    expect(mocks.listBuyerPoliciesForActor).toHaveBeenCalledWith(buyerActor);
    expect(mocks.listBuyerRequestAnalyticsForActor).toHaveBeenCalledWith(buyerActor, {});
    expect(mocks.listBuyerApprovalsForActor).toHaveBeenCalledWith(buyerActor);
  });

  it("routes seller pages through actor-aware read wrappers", async () => {
    await SellerPage();
    await SellerServicesPage({ searchParams: Promise.resolve({}) });
    await SellerRequestsPage({ searchParams: Promise.resolve({}) });

    expect(mocks.getSellerProfileForActor).toHaveBeenCalledWith(sellerActor);
    expect(mocks.getSellerAnalyticsForActor).toHaveBeenCalledWith(sellerActor);
    expect(mocks.listSellerTeamMembersForActor).toHaveBeenCalledWith(sellerActor);
    expect(mocks.listSellerServicesForActor).toHaveBeenCalledWith(sellerActor);
    expect(mocks.listSellerRequestsForActor).toHaveBeenCalledWith(sellerActor);
    expect(mocks.listSellerRequestAnalyticsForActor).toHaveBeenCalledWith(sellerActor, {});
  });
});
