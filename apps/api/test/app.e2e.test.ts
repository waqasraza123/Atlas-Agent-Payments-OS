import "reflect-metadata";
import type { AtlasActorContext } from "@atlas/auth";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AppModule } from "../src/app.module";
import { ActorResolutionService } from "../src/modules/actor/actor.service";
import {
  AtlasAnalyticsReportingError,
  AtlasBuyerWorkflowError,
  AtlasPaymentsWorkflowError,
  AtlasProgrammableSettlementError
} from "@atlas/database";

const databaseMock = vi.hoisted(() => ({
  listBuyerAgents: vi.fn(async () => []),
  createBuyerAgent: vi.fn(async (_actor: unknown, input: Record<string, unknown>) => ({
    id: "agent-created",
    name: String(input.name ?? "Created Agent"),
    externalRef: null,
    purpose: String(input.purpose ?? ""),
    status: String(input.status ?? "DRAFT"),
    policyId: null,
    policyName: null,
    requestCount: 0
  })),
  updateBuyerAgent: vi.fn(async () => ({
    id: "agent-updated",
    name: "Updated Agent",
    externalRef: null,
    purpose: "Updated purpose",
    status: "ACTIVE",
    policyId: null,
    policyName: null,
    requestCount: 1
  })),
  listBuyerPolicies: vi.fn(async () => []),
  createBuyerPolicy: vi.fn(async () => ({
    id: "policy-created",
    name: "Created Policy",
    status: "ACTIVE",
    version: 1,
    rules: {
      maxAmountMinor: 5000,
      autoApprovalThresholdMinor: 2500,
      escalationThresholdMinor: null,
      sellerAllowlist: [],
      serviceAllowlist: [],
      serviceCategories: ["api-access"],
      emergencyStop: false
    },
    linkedAgentCount: 0,
    requestCount: 0
  })),
  updateBuyerPolicy: vi.fn(async () => ({
    id: "policy-updated",
    name: "Updated Policy",
    status: "ACTIVE",
    version: 2,
    rules: {
      maxAmountMinor: 5000,
      autoApprovalThresholdMinor: 2500,
      escalationThresholdMinor: null,
      sellerAllowlist: [],
      serviceAllowlist: [],
      serviceCategories: ["api-access"],
      emergencyStop: false
    },
    linkedAgentCount: 1,
    requestCount: 1
  })),
  listBuyerRequests: vi.fn(async () => []),
  createBuyerRequest: vi.fn(async () => ({
    id: "request-created",
    agentId: "agent-1",
    agentName: "Procurement Agent",
    policyId: "policy-1",
    policyName: "Low Risk API Access",
    sellerOrganizationId: "seller-1",
    sellerOrganizationName: "Atlas Demo Seller",
    title: "Created Request",
    purpose: "Submit a paid request for a production buyer workflow test.",
    amountMinor: 2400,
    currency: "USD",
    serviceCategory: "api-access",
    status: "SUBMITTED",
    approvalStatus: "PENDING",
    evaluationOutcome: "allow_requires_approval",
    createdAt: new Date().toISOString()
  })),
  listBuyerApprovals: vi.fn(async () => []),
  decideBuyerApproval: vi.fn(async () => ({
    id: "approval-1",
    requestId: "request-created",
    requestTitle: "Created Request",
    amountMinor: 2400,
    currency: "USD",
    serviceCategory: "api-access",
    status: "APPROVED",
    decisionReason: "Within delegated approval threshold",
    createdAt: new Date().toISOString()
  })),
  getBuyerApprovalRoleGuard: vi.fn(async () => undefined),
  getSellerProfile: vi.fn(async () => ({
    organizationId: "org-seller",
    organizationSlug: "atlas-demo-seller",
    organizationName: "Atlas Demo Seller",
    serviceCount: 3,
    publishedServiceCount: 2,
    requestCount: 4,
    activeBuyerCount: 2
  })),
  listSellerTeamMembers: vi.fn(async () => [
    {
      membershipId: "membership-seller",
      userId: "user-seller",
      userEmail: "seller@atlas.local",
      userName: "Seller Admin",
      role: "ADMIN"
    }
  ]),
  listSellerRequests: vi.fn(async () => [
    {
      id: "seller-request-1",
      buyerOrganizationId: "buyer-1",
      buyerOrganizationName: "Atlas Demo Buyer",
      title: "Premium dataset unlock",
      purpose: "Unlock a premium dataset.",
      amountMinor: 8900,
      currency: "USD",
      serviceCategory: "digital-service",
      serviceKey: "global-dataset-access",
      matchedServiceId: "service-1",
      matchedServiceName: "Global Dataset Access",
      status: "SUBMITTED",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      fulfillment: null
    }
  ]),
  getSellerAnalytics: vi.fn(async () => ({
    pendingFulfillmentCount: 2,
    completedRequestCount: 3,
    failedRequestCount: 1,
    unmatchedRequestCount: 1,
    topServices: [
      {
        serviceId: "service-1",
        serviceKey: "global-dataset-access",
        serviceName: "Global Dataset Access",
        requestCount: 2,
        completedRequestCount: 1,
        failedRequestCount: 0
      }
    ],
    topBuyers: [
      {
        buyerOrganizationId: "buyer-1",
        buyerOrganizationName: "Atlas Demo Buyer",
        requestCount: 3,
        completedRequestCount: 1,
        failedRequestCount: 1
      }
    ]
  })),
  listSellerServices: vi.fn(async () => [
    {
      id: "service-1",
      organizationId: "org-seller",
      key: "global-dataset-access",
      name: "Global Dataset Access",
      description: "Premium dataset service.",
      category: "digital-service",
      status: "PUBLISHED",
      visibility: "TRUSTED_BUYERS",
      pricingModel: "FIXED",
      priceMinor: 8900,
      currency: "USD",
      linkedRequestCount: 2
    }
  ]),
  getSellerService: vi.fn(async () => ({
    id: "service-1",
    organizationId: "org-seller",
    key: "global-dataset-access",
    name: "Global Dataset Access",
    description: "Premium dataset service.",
    category: "digital-service",
    status: "PUBLISHED",
    visibility: "TRUSTED_BUYERS",
    pricingModel: "FIXED",
    priceMinor: 8900,
    currency: "USD",
    linkedRequestCount: 2
  })),
  createSellerService: vi.fn(async () => ({
    id: "service-created",
    organizationId: "org-seller",
    key: "seller-created-service",
    name: "Created Seller Service",
    description: "Created seller service description for API coverage.",
    category: "api-access",
    status: "DRAFT",
    visibility: "PRIVATE",
    pricingModel: "FIXED",
    priceMinor: 1900,
    currency: "USD",
    linkedRequestCount: 0
  })),
  updateSellerService: vi.fn(async () => ({
    id: "service-updated",
    organizationId: "org-seller",
    key: "seller-updated-service",
    name: "Updated Seller Service",
    description: "Updated seller service description for API coverage.",
    category: "api-access",
    status: "PUBLISHED",
    visibility: "PUBLIC",
    pricingModel: "FIXED",
    priceMinor: 2400,
    currency: "USD",
    linkedRequestCount: 3
  })),
  recordSellerRequestFulfillment: vi.fn(async () => ({
    id: "seller-request-1",
    buyerOrganizationId: "buyer-1",
    buyerOrganizationName: "Atlas Demo Buyer",
    title: "Premium dataset unlock",
    purpose: "Unlock a premium dataset.",
    amountMinor: 8900,
    currency: "USD",
    serviceCategory: "digital-service",
    serviceKey: "global-dataset-access",
    matchedServiceId: "service-1",
    matchedServiceName: "Global Dataset Access",
    status: "COMPLETED",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    fulfillment: {
      fulfillmentStatus: "DELIVERED",
      note: "The seller delivered the dataset unlock and recorded the outcome.",
      recordedAt: new Date().toISOString()
    }
  })),
  listPaymentIntents: vi.fn(async () => [
    {
      id: "payment-1",
      requestId: "request-created",
      buyerOrganizationId: "org-buyer",
      buyerOrganizationName: "Atlas Demo Buyer",
      sellerOrganizationId: "org-seller",
      sellerOrganizationName: "Atlas Demo Seller",
      rail: "INTERNAL_SIMULATED",
      status: "CAPTURED",
      provider: "simulated",
      reference: "sim-request-created-captured-01",
      amountMinor: 2400,
      currency: "USD",
      latestAttemptNumber: 1,
      latestAttemptStatus: "CAPTURED",
      requestStatus: "COMPLETED",
      receiptStatus: "AVAILABLE",
      sellerFulfillmentStatus: "DELIVERED",
      retryEligible: false,
      reconciliationState: "RECEIPT_AVAILABLE",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attempts: [
        {
          id: "attempt-1",
          paymentId: "payment-1",
          attemptNumber: 1,
          rail: "INTERNAL_SIMULATED",
          status: "CAPTURED",
          reference: "sim-request-created-captured-01",
          providerStatus: "captured",
          evidence: {
            providerStatus: "captured",
            paymentIntentId: null
          },
          errorCode: null,
          errorMessage: null,
          createdAt: new Date().toISOString()
        }
      ]
    }
  ]),
  getPaymentIntent: vi.fn(async () => ({
    id: "payment-1",
    requestId: "request-created",
    buyerOrganizationId: "org-buyer",
    buyerOrganizationName: "Atlas Demo Buyer",
    sellerOrganizationId: "org-seller",
    sellerOrganizationName: "Atlas Demo Seller",
    rail: "INTERNAL_SIMULATED",
    status: "CAPTURED",
    provider: "simulated",
    reference: "sim-request-created-captured-01",
    amountMinor: 2400,
    currency: "USD",
    latestAttemptNumber: 1,
    latestAttemptStatus: "CAPTURED",
    requestStatus: "COMPLETED",
    receiptStatus: "AVAILABLE",
    sellerFulfillmentStatus: "DELIVERED",
    retryEligible: false,
    reconciliationState: "RECEIPT_AVAILABLE",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    attempts: [
      {
        id: "attempt-1",
        paymentId: "payment-1",
        attemptNumber: 1,
        rail: "INTERNAL_SIMULATED",
        status: "CAPTURED",
        reference: "sim-request-created-captured-01",
        providerStatus: "captured",
        evidence: {
          providerStatus: "captured",
          paymentIntentId: null
        },
        errorCode: null,
        errorMessage: null,
        createdAt: new Date().toISOString()
      }
    ]
  })),
  executeBuyerPayment: vi.fn(async () => ({
    id: "payment-executed",
    requestId: "request-created",
    buyerOrganizationId: "org-buyer",
    buyerOrganizationName: "Atlas Demo Buyer",
    sellerOrganizationId: "org-seller",
    sellerOrganizationName: "Atlas Demo Seller",
    rail: "INTERNAL_SIMULATED",
    status: "CAPTURED",
    provider: "simulated",
    reference: "sim-request-created-captured-01",
    amountMinor: 2400,
    currency: "USD",
    latestAttemptNumber: 1,
    latestAttemptStatus: "CAPTURED",
    requestStatus: "COMPLETED",
    receiptStatus: "AVAILABLE",
    sellerFulfillmentStatus: "DELIVERED",
    retryEligible: false,
    reconciliationState: "RECEIPT_AVAILABLE",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    attempts: [
      {
        id: "attempt-1",
        paymentId: "payment-executed",
        attemptNumber: 1,
        rail: "INTERNAL_SIMULATED",
        status: "CAPTURED",
        reference: "sim-request-created-captured-01",
        providerStatus: "captured",
        evidence: {
          providerStatus: "captured",
          paymentIntentId: null
        },
        errorCode: null,
        errorMessage: null,
        createdAt: new Date().toISOString()
      }
    ]
  })),
  listReceiptRecords: vi.fn(async () => [
    {
      id: "receipt-1",
      requestId: "request-created",
      buyerOrganizationId: "org-buyer",
      buyerOrganizationName: "Atlas Demo Buyer",
      sellerOrganizationId: "org-seller",
      sellerOrganizationName: "Atlas Demo Seller",
      requestTitle: "Created Request",
      requestStatus: "COMPLETED",
      serviceCategory: "api-access",
      status: "AVAILABLE",
      amountMinor: 2400,
      currency: "USD",
      storageKey: "receipts/request-created.json",
      contentType: "application/json",
      paymentReference: "sim-request-created-captured-01",
      paymentStatus: "CAPTURED",
      sellerFulfillmentStatus: "DELIVERED",
      rail: "INTERNAL_SIMULATED",
      providerStatus: "captured",
      attemptCount: 1,
      reconciliationState: "RECEIPT_AVAILABLE",
      evidenceSummary: [
        "Reconciliation Receipt Available",
        "Payment Captured",
        "Provider captured",
        "Reference sim-request-created-captured-01",
        "Artifact receipts/request-created.json",
        "Attempts 1",
        "Seller Delivered"
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ]),
  getReceiptRecord: vi.fn(async () => ({
    id: "receipt-1",
    requestId: "request-created",
    buyerOrganizationId: "org-buyer",
    buyerOrganizationName: "Atlas Demo Buyer",
    sellerOrganizationId: "org-seller",
    sellerOrganizationName: "Atlas Demo Seller",
    requestTitle: "Created Request",
    requestStatus: "COMPLETED",
    serviceCategory: "api-access",
    status: "AVAILABLE",
    amountMinor: 2400,
    currency: "USD",
    storageKey: "receipts/request-created.json",
    contentType: "application/json",
    paymentReference: "sim-request-created-captured-01",
    paymentStatus: "CAPTURED",
    sellerFulfillmentStatus: "DELIVERED",
    rail: "INTERNAL_SIMULATED",
    providerStatus: "captured",
    attemptCount: 1,
    reconciliationState: "RECEIPT_AVAILABLE",
    evidenceSummary: [
      "Reconciliation Receipt Available",
      "Payment Captured",
      "Provider captured",
      "Reference sim-request-created-captured-01",
      "Artifact receipts/request-created.json",
      "Attempts 1",
      "Seller Delivered"
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  })),
  getOperatorOverview: vi.fn(async () => ({
    openCaseCount: 2,
    criticalCaseCount: 1,
    actionRequiredCount: 1,
    unreadNotificationCount: 2,
    delayedCaseCount: 1,
    failedCaseCount: 1,
    recentCases: [
      {
        id: "case-1",
        caseKey: "PAYMENT_FAILURE:request-created",
        category: "PAYMENT_FAILURE",
        severity: "HIGH",
        status: "OPEN",
        title: "Payment failure · Created Request",
        summary: "A payment attempt failed or was voided before the request reached a final usable receipt state.",
        requestId: "request-created",
        paymentId: "payment-1",
        paymentRail: "INTERNAL_SIMULATED",
        receiptId: "receipt-1",
        buyerOrganizationId: "org-buyer",
        buyerOrganizationName: "Atlas Demo Buyer",
        sellerOrganizationId: "org-seller",
        sellerOrganizationName: "Atlas Demo Seller",
        requestTitle: "Created Request",
        requestStatus: "FAILED",
        paymentStatus: "FAILED",
        receiptStatus: "FAILED",
        providerStatus: "failed",
        reconciliationState: "FAILED",
        attemptCount: 2,
        paused: false,
        resolutionReason: null,
        availableActions: ["ANNOTATE_CASE", "PAUSE_REQUEST", "REQUEUE_PAYMENT", "RESOLVE_CASE"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ],
    recentNotifications: [
      {
        id: "notification-1",
        dedupeKey: "operator-case:PAYMENT_FAILURE:request-created",
        caseId: "case-1",
        category: "PAYMENT_FAILURE",
        title: "Payment failure · Created Request",
        description: "A payment attempt failed or was voided before the request reached a final usable receipt state.",
        status: "UNREAD",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ],
    recentAuditEvents: [
      {
        id: "audit-1",
        eventType: "operator.case_opened",
        targetType: "OperatorCase",
        targetId: "case-1",
        actorType: "SYSTEM",
        actorLabel: "Atlas system",
        organizationName: "Atlas Demo Buyer",
        requestTitle: "Created Request",
        occurredAt: new Date().toISOString()
      }
    ]
  })),
  listOperatorCases: vi.fn(async () => [
    {
      id: "case-1",
      caseKey: "PAYMENT_FAILURE:request-created",
      category: "PAYMENT_FAILURE",
      severity: "HIGH",
      status: "OPEN",
      title: "Payment failure · Created Request",
      summary: "A payment attempt failed or was voided before the request reached a final usable receipt state.",
      requestId: "request-created",
      paymentId: "payment-1",
      paymentRail: "INTERNAL_SIMULATED",
      receiptId: "receipt-1",
      buyerOrganizationId: "org-buyer",
      buyerOrganizationName: "Atlas Demo Buyer",
      sellerOrganizationId: "org-seller",
      sellerOrganizationName: "Atlas Demo Seller",
      requestTitle: "Created Request",
      requestStatus: "FAILED",
      paymentStatus: "FAILED",
      receiptStatus: "FAILED",
      providerStatus: "failed",
      reconciliationState: "FAILED",
      attemptCount: 2,
      paused: false,
      resolutionReason: null,
      availableActions: ["ANNOTATE_CASE", "PAUSE_REQUEST", "REQUEUE_PAYMENT", "RESOLVE_CASE"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ]),
  getOperatorCase: vi.fn(async () => ({
    item: {
      id: "case-1",
      caseKey: "PAYMENT_FAILURE:request-created",
      category: "PAYMENT_FAILURE",
      severity: "HIGH",
      status: "OPEN",
      title: "Payment failure · Created Request",
      summary: "A payment attempt failed or was voided before the request reached a final usable receipt state.",
      requestId: "request-created",
      paymentId: "payment-1",
      paymentRail: "INTERNAL_SIMULATED",
      receiptId: "receipt-1",
      buyerOrganizationId: "org-buyer",
      buyerOrganizationName: "Atlas Demo Buyer",
      sellerOrganizationId: "org-seller",
      sellerOrganizationName: "Atlas Demo Seller",
      requestTitle: "Created Request",
      requestStatus: "FAILED",
      paymentStatus: "FAILED",
      receiptStatus: "FAILED",
      providerStatus: "failed",
      reconciliationState: "FAILED",
      attemptCount: 2,
      paused: false,
      resolutionReason: null,
      availableActions: ["ANNOTATE_CASE", "PAUSE_REQUEST", "REQUEUE_PAYMENT", "RESOLVE_CASE"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    actions: [
      {
        id: "operator-action-1",
        caseId: "case-1",
        actionType: "ANNOTATE_CASE",
        reason: "Initial operator triage note.",
        actorUserId: "user-operator",
        actorUserName: "Operator Tester",
        actorUserEmail: "operator@atlas.local",
        createdAt: new Date().toISOString()
      }
    ],
    notifications: [
      {
        id: "notification-1",
        dedupeKey: "operator-case:PAYMENT_FAILURE:request-created",
        caseId: "case-1",
        category: "PAYMENT_FAILURE",
        title: "Payment failure · Created Request",
        description: "A payment attempt failed or was voided before the request reached a final usable receipt state.",
        status: "UNREAD",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ],
    auditEvents: [
      {
        id: "audit-1",
        eventType: "operator.case_opened",
        targetType: "OperatorCase",
        targetId: "case-1",
        actorType: "SYSTEM",
        actorLabel: "Atlas system",
        organizationName: "Atlas Demo Buyer",
        requestTitle: "Created Request",
        occurredAt: new Date().toISOString()
      }
    ]
  })),
  listOperatorNotifications: vi.fn(async () => [
    {
      id: "notification-1",
      dedupeKey: "operator-case:PAYMENT_FAILURE:request-created",
      caseId: "case-1",
      category: "PAYMENT_FAILURE",
      title: "Payment failure · Created Request",
      description: "A payment attempt failed or was voided before the request reached a final usable receipt state.",
      status: "UNREAD",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ]),
  performOperatorCaseAction: vi.fn(async () => ({
    item: {
      id: "case-1",
      caseKey: "PAYMENT_FAILURE:request-created",
      category: "PAYMENT_FAILURE",
      severity: "HIGH",
      status: "INVESTIGATING",
      title: "Payment failure · Created Request",
      summary: "A payment attempt failed or was voided before the request reached a final usable receipt state.",
      requestId: "request-created",
      paymentId: "payment-1",
      paymentRail: "INTERNAL_SIMULATED",
      receiptId: "receipt-1",
      buyerOrganizationId: "org-buyer",
      buyerOrganizationName: "Atlas Demo Buyer",
      sellerOrganizationId: "org-seller",
      sellerOrganizationName: "Atlas Demo Seller",
      requestTitle: "Created Request",
      requestStatus: "FAILED",
      paymentStatus: "FAILED",
      receiptStatus: "FAILED",
      providerStatus: "failed",
      reconciliationState: "FAILED",
      attemptCount: 2,
      paused: true,
      resolutionReason: null,
      availableActions: ["ANNOTATE_CASE", "RELEASE_REQUEST", "RESOLVE_CASE"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    actions: [],
    notifications: [],
    auditEvents: []
  })),
  listOperatorAuditEvents: vi.fn(async () => [
    {
      id: "audit-1",
      eventType: "operator.case_opened",
      targetType: "OperatorCase",
      targetId: "case-1",
      actorType: "SYSTEM",
      actorLabel: "Atlas system",
      organizationName: "Atlas Demo Buyer",
      requestTitle: "Created Request",
      occurredAt: new Date().toISOString()
    }
  ]),
  getBuyerAnalytics: vi.fn(async () => ({
    totalSpendMinor: 12400,
    requestCount: 4,
    completedRequestCount: 2,
    pendingApprovalCount: 1,
    autoApprovedCount: 1,
    manualApprovedCount: 2,
    exceptionRate: 0.25,
    budgetUtilizationRate: 0.31,
    averageApprovalTurnaroundHours: 2.5,
    spendTimeline: [
      {
        label: "Apr 11",
        count: 2,
        amountMinor: 12400
      }
    ],
    topAgents: [],
    topSellers: [],
    topServices: [],
    statusMix: []
  })),
  listBuyerRequestAnalytics: vi.fn(async () => [
    {
      id: "request-created",
      title: "Created Request",
      purpose: "Submit a paid request for a production buyer workflow test.",
      agentName: "Procurement Agent",
      sellerOrganizationName: "Atlas Demo Seller",
      amountMinor: 2400,
      currency: "USD",
      serviceCategory: "api-access",
      serviceKey: "global-dataset-access",
      requestStatus: "COMPLETED",
      approvalStatus: "APPROVED",
      paymentStatus: "CAPTURED",
      receiptStatus: "AVAILABLE",
      paymentRail: "INTERNAL_SIMULATED",
      evaluationOutcome: "allow_requires_approval",
      reconciliationState: "RECEIPT_AVAILABLE",
      createdAt: new Date().toISOString()
    }
  ]),
  listBuyerActivityAnalytics: vi.fn(async () => [
    {
      id: "audit-buyer-1",
      eventType: "request_created",
      targetType: "request",
      targetId: "request-created",
      actorType: "HUMAN",
      actorLabel: "BUYER Tester",
      requestTitle: "Created Request",
      occurredAt: new Date().toISOString()
    }
  ]),
  exportBuyerRequestCsv: vi.fn(async () => "Request ID,Title\nrequest-created,Created Request"),
  getSellerRevenueAnalytics: vi.fn(async () => ({
    totalRevenueMinor: 18900,
    requestCount: 5,
    completedRequestCount: 3,
    pendingFulfillmentCount: 1,
    repeatBuyerCount: 1,
    revenueTimeline: [
      {
        label: "Apr 11",
        count: 3,
        amountMinor: 18900
      }
    ],
    topServices: [],
    topBuyers: [],
    statusMix: []
  })),
  listSellerRequestAnalytics: vi.fn(async () => [
    {
      id: "seller-request-1",
      title: "Premium dataset unlock",
      buyerOrganizationName: "Atlas Demo Buyer",
      amountMinor: 8900,
      currency: "USD",
      serviceCategory: "digital-service",
      serviceKey: "global-dataset-access",
      matchedServiceName: "Global Dataset Access",
      requestStatus: "COMPLETED",
      paymentStatus: "CAPTURED",
      receiptStatus: "AVAILABLE",
      fulfillmentStatus: "DELIVERED",
      reconciliationState: "RECEIPT_AVAILABLE",
      createdAt: new Date().toISOString()
    }
  ]),
  exportSellerRequestCsv: vi.fn(async () => "Request ID,Title\nseller-request-1,Premium dataset unlock"),
  getPlatformAnalytics: vi.fn(async () => ({
    activeOrganizationCount: 3,
    activeAgentCount: 4,
    totalRequestCount: 7,
    totalApprovalCount: 3,
    successfulPaymentCount: 2,
    openExceptionCount: 1,
    averageRequestCompletionHours: 4.2,
    requestTimeline: [
      {
        label: "Apr 11",
        count: 7,
        amountMinor: 25200
      }
    ],
    railMix: [],
    categoryMix: []
  })),
  listPlatformTransactions: vi.fn(async () => [
    {
      id: "request-created",
      requestTitle: "Created Request",
      buyerOrganizationName: "Atlas Demo Buyer",
      sellerOrganizationName: "Atlas Demo Seller",
      amountMinor: 2400,
      currency: "USD",
      requestStatus: "COMPLETED",
      paymentStatus: "CAPTURED",
      receiptStatus: "AVAILABLE",
      paymentRail: "INTERNAL_SIMULATED",
      providerStatus: "captured",
      reconciliationState: "RECEIPT_AVAILABLE",
      attemptCount: 1,
      createdAt: new Date().toISOString()
    }
  ]),
  listPlatformOrganizations: vi.fn(async () => [
    {
      organizationId: "org-buyer",
      organizationName: "Atlas Demo Buyer",
      organizationKind: "BUYER",
      requestCount: 4,
      paymentCount: 2,
      receiptAvailableCount: 1,
      openCaseCount: 1,
      lastActivityAt: new Date().toISOString()
    }
  ]),
  exportPlatformTransactionCsv: vi.fn(async () => "Request ID,Request Title\nrequest-created,Created Request"),
  getOrganizationProgrammableSettlement: vi.fn(async () => ({
    organizationId: "org-buyer",
    organizationName: "Atlas Demo Buyer",
    organizationSlug: "atlas-demo-buyer",
    organizationKind: "BUYER",
    settings: {
      allowedRails: ["INTERNAL_SIMULATED", "STRIPE", "PROGRAMMABLE_USDC"],
      preferredRail: "PROGRAMMABLE_USDC"
    },
    supportedChain: {
      key: "BASE_SEPOLIA",
      chainId: 84532,
      label: "Base Sepolia",
      networkName: "Base Sepolia",
      assetSymbol: "USDC",
      explorerBaseUrl: "https://sepolia.basescan.org/tx/",
      requiredConfirmations: 2,
      enabled: true
    },
    wallets: [
      {
        id: "wallet-buyer-primary",
        organizationId: "org-buyer",
        organizationName: "Atlas Demo Buyer",
        organizationKind: "BUYER",
        label: "Buyer Treasury",
        address: "0x1111111111111111111111111111111111111111",
        chain: "BASE_SEPOLIA",
        chainLabel: "Base Sepolia",
        verificationStatus: "VERIFIED",
        ownershipLabel: "Atlas Demo Buyer Treasury",
        isDefault: true,
        verificationNote: "Verified for programmable settlement.",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ],
    readiness: {
      ready: true,
      reasons: []
    }
  })),
  listOrganizationWallets: vi.fn(async () => [
    {
      id: "wallet-buyer-primary",
      organizationId: "org-buyer",
      organizationName: "Atlas Demo Buyer",
      organizationKind: "BUYER",
      label: "Buyer Treasury",
      address: "0x1111111111111111111111111111111111111111",
      chain: "BASE_SEPOLIA",
      chainLabel: "Base Sepolia",
      verificationStatus: "VERIFIED",
      ownershipLabel: "Atlas Demo Buyer Treasury",
      isDefault: true,
      verificationNote: "Verified for programmable settlement.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ]),
  createOrganizationWallet: vi.fn(async () => ({
    id: "wallet-created",
    organizationId: "org-buyer",
    organizationName: "Atlas Demo Buyer",
    organizationKind: "BUYER",
    label: "New Wallet",
    address: "0x5555555555555555555555555555555555555555",
    chain: "BASE_SEPOLIA",
    chainLabel: "Base Sepolia",
    verificationStatus: "PENDING",
    ownershipLabel: "New Treasury Wallet",
    isDefault: false,
    verificationNote: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  })),
  updateOrganizationProgrammableSettlementSettings: vi.fn(async () => ({
    organizationId: "org-buyer",
    organizationName: "Atlas Demo Buyer",
    organizationSlug: "atlas-demo-buyer",
    organizationKind: "BUYER",
    settings: {
      allowedRails: ["INTERNAL_SIMULATED", "PROGRAMMABLE_USDC"],
      preferredRail: "PROGRAMMABLE_USDC"
    },
    supportedChain: {
      key: "BASE_SEPOLIA",
      chainId: 84532,
      label: "Base Sepolia",
      networkName: "Base Sepolia",
      assetSymbol: "USDC",
      explorerBaseUrl: "https://sepolia.basescan.org/tx/",
      requiredConfirmations: 2,
      enabled: true
    },
    wallets: [],
    readiness: {
      ready: false,
      reasons: ["A verified default organization wallet is required."]
    }
  })),
  listProgrammableSettlementOrganizations: vi.fn(async () => [
    {
      organizationId: "org-buyer",
      organizationName: "Atlas Demo Buyer",
      organizationSlug: "atlas-demo-buyer",
      organizationKind: "BUYER",
      settings: {
        allowedRails: ["INTERNAL_SIMULATED", "PROGRAMMABLE_USDC"],
        preferredRail: "PROGRAMMABLE_USDC"
      },
      supportedChain: {
        key: "BASE_SEPOLIA",
        chainId: 84532,
        label: "Base Sepolia",
        networkName: "Base Sepolia",
        assetSymbol: "USDC",
        explorerBaseUrl: "https://sepolia.basescan.org/tx/",
        requiredConfirmations: 2,
        enabled: true
      },
      wallets: [],
      readiness: {
        ready: false,
        reasons: ["A verified default organization wallet is required."]
      }
    }
  ]),
  verifyOrganizationWallet: vi.fn(async () => ({
    id: "wallet-buyer-primary",
    organizationId: "org-buyer",
    organizationName: "Atlas Demo Buyer",
    organizationKind: "BUYER",
    label: "Buyer Treasury",
    address: "0x1111111111111111111111111111111111111111",
    chain: "BASE_SEPOLIA",
    chainLabel: "Base Sepolia",
    verificationStatus: "VERIFIED",
    ownershipLabel: "Atlas Demo Buyer Treasury",
    isDefault: true,
    verificationNote: "Verified by operator",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  })),
  listExternalIdentityAssignments: vi.fn(async () => [
    {
      id: "assignment-1",
      provider: "okta-design-partner",
      externalEmail: "buyer-admin@example.com",
      userId: "user-buyer",
      userEmail: "buyer-admin@example.com",
      userName: "Buyer Admin",
      organizationId: "org-buyer",
      organizationSlug: "atlas-demo-buyer",
      organizationName: "Atlas Demo Buyer",
      workspace: "BUYER",
      membershipId: "membership-buyer-admin",
      role: "ADMIN",
      status: "ACTIVE",
      statusReason: "Design partner buyer admin provisioned for external rollout.",
      provisionedAt: new Date().toISOString(),
      lastExchangedAt: new Date().toISOString(),
      statusChangedAt: new Date().toISOString(),
      provisionedByUserEmail: "operator-admin@atlas.local",
      statusChangedByUserEmail: "operator-admin@atlas.local",
      activeSessionCount: 1
    }
  ]),
  listAtlasUpstreamIdentityLifecycleReports: vi.fn(async () => [
    {
      version: 1,
      provider: "okta-scim",
      mode: "dry-run",
      action: "PROVISION",
      generatedAt: new Date().toISOString(),
      reportPath: "/tmp/upstream-list.json",
      actorUserEmail: "operator-admin@atlas.local",
      assignmentId: "assignment-1",
      externalEmail: "buyer-admin@example.com",
      organizationSlug: "atlas-demo-buyer",
      role: "ADMIN",
      operationalIntegration: null,
      command: {
        configured: false,
        exitCode: null,
        stdout: "",
        stderr: ""
      },
      adapterResult: null
    }
  ]),
  executeAtlasUpstreamIdentityLifecycle: vi.fn(async () => ({
    report: {
      version: 1,
      provider: "okta-scim",
      mode: "dry-run",
      action: "PROVISION",
      generatedAt: new Date().toISOString(),
      reportPath: "/tmp/upstream.json",
      actorUserEmail: "operator-admin@atlas.local",
      assignmentId: "assignment-created",
      externalEmail: "seller-admin@example.com",
      organizationSlug: "atlas-demo-seller",
      role: "ADMIN",
      operationalIntegration: null,
      command: {
        configured: false,
        exitCode: null,
        stdout: "",
        stderr: ""
      },
      adapterResult: null
    },
    reportPath: "/tmp/upstream.json"
  })),
  provisionExternalIdentityAssignment: vi.fn(async () => ({
    id: "assignment-created",
    provider: "okta-design-partner",
    externalEmail: "seller-admin@example.com",
    userId: "user-seller-admin",
    userEmail: "seller-admin@example.com",
    userName: "Seller Admin",
    organizationId: "org-seller",
    organizationSlug: "atlas-demo-seller",
    organizationName: "Atlas Demo Seller",
    workspace: "SELLER",
    membershipId: "membership-seller-admin",
    role: "ADMIN",
    status: "ACTIVE",
    statusReason: "Provisioned for seller rollout validation.",
    provisionedAt: new Date().toISOString(),
    lastExchangedAt: null,
    statusChangedAt: new Date().toISOString(),
    provisionedByUserEmail: "operator-admin@atlas.local",
    statusChangedByUserEmail: "operator-admin@atlas.local",
    activeSessionCount: 0
  })),
  updateExternalIdentityAssignmentLifecycle: vi.fn(async () => ({
    assignment: {
      id: "assignment-1",
      provider: "okta-design-partner",
      externalEmail: "buyer-admin@example.com",
      userId: "user-buyer",
      userEmail: "buyer-admin@example.com",
      userName: "Buyer Admin",
      organizationId: "org-buyer",
      organizationSlug: "atlas-demo-buyer",
      organizationName: "Atlas Demo Buyer",
      workspace: "BUYER",
      membershipId: "membership-buyer-admin",
      role: "ADMIN",
      status: "SUSPENDED",
      statusReason: "Temporarily suspended during tenant review.",
      provisionedAt: new Date().toISOString(),
      lastExchangedAt: new Date().toISOString(),
      statusChangedAt: new Date().toISOString(),
      provisionedByUserEmail: "operator-admin@atlas.local",
      statusChangedByUserEmail: "operator-admin@atlas.local",
      activeSessionCount: 0
    },
    revokedSessionCount: 1
  })),
  listAtlasRolloutAutomationSummary: vi.fn(() => ({
    upstreamIdentity: {
      mode: "command",
      provider: "okta-scim",
      reportDirectory: "operations-artifacts/upstream-identity"
    },
    restoreDrill: {
      mode: "command",
      provider: "kubernetes-job",
      reportDirectory: "restore-drills"
    },
    secretRotation: {
      mode: "command",
      provider: "aws-secrets-manager",
      reportDirectory: "rotation-executions"
    },
    deploymentAutomation: {
      mode: "command",
      provider: "github-actions",
      reportDirectory: "promotion-executions"
    }
  })),
  listAtlasRestoreDrillReports: vi.fn(() => []),
  listAtlasSecretRotationExecutionReports: vi.fn(() => []),
  listAtlasPromotionExecutionReports: vi.fn(() => []),
  getOperationalExecutionSummary: vi.fn(async () => ({
    totalCount: 5,
    commandCount: 3,
    dryRunCount: 2,
    failedCount: 1,
    latestCompletedAt: new Date().toISOString()
  })),
  listOperationalExecutions: vi.fn(async () => [
    {
      id: "execution-1",
      kind: "DEPLOYMENT_PROMOTION",
      mode: "COMMAND",
      status: "SUCCEEDED",
      targetEnvironment: "STAGING",
      provider: "github-actions",
      actorUserEmail: "operator-admin@atlas.local",
      summary: "Promotion dispatched from development to staging for api, web, worker.",
      providerOperationId: "deploy-123",
      targetReference: "atlas/payments-os/deploy.yml",
      reportPath: "/tmp/promotion-report.json",
      metadata: null,
      completedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      operationalIntegration: null,
      proofArtifacts: [
        {
          id: "artifact-1",
          kind: "BUNDLE",
          label: "promotion bundle",
          filePath: "/tmp/promotion.json",
          sha256: "a".repeat(64),
          sizeBytes: 128,
          storageProvider: null,
          storageBucket: null,
          storageKey: null,
          storageUrl: null,
          metadata: null,
          createdAt: new Date().toISOString()
        }
      ]
    }
  ]),
  listOperationalIntegrations: vi.fn(async () => [
    {
      id: "integration-1",
      kind: "DEPLOYMENT_AUTOMATION",
      targetEnvironment: "STAGING",
      provider: "github-actions",
      label: "staging github runner",
      ownerEmail: "platform-ops@atlas.local",
      endpointReference: "atlas/payments-os",
      secretReference: "aws-secrets://atlas/staging/deployer",
      configReference: "deploy-staging",
      status: "ACTIVE",
      verificationStatus: "VERIFIED",
      verificationReason: "Verified against the owned staging deployment runner.",
      statusReason: null,
      metadata: null,
      lastVerifiedAt: new Date().toISOString(),
      lastUsedAt: null,
      createdByUserEmail: "operator-admin@atlas.local",
      updatedByUserEmail: "operator-admin@atlas.local",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ]),
  listObservabilitySnapshots: vi.fn(async () => [
    {
      id: "snapshot-1",
      appEnv: "staging",
      releaseStage: "private-beta",
      actorUserEmail: "operator-admin@atlas.local",
      configurationStatus: "valid",
      readinessStatus: "ready",
      totalRequests: 42,
      errorCount: 4,
      activeAlertCount: 2,
      criticalAlertCount: 1,
      reportPath: "/tmp/observability-snapshot.json",
      storageUrl: null,
      expiresAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    }
  ]),
  listObservabilityAlertDispatches: vi.fn(async () => [
    {
      id: "dispatch-1",
      provider: "generic-webhook",
      deliveryKind: "alert-dispatch",
      mode: "command",
      status: "SUCCEEDED",
      minimumSeverity: "warning",
      actorUserEmail: "operator-admin@atlas.local",
      summary: "2 alerts met the warning threshold for staging.",
      targetReference: "https://alerts.atlas.local/webhook",
      traceId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      reportPath: "/tmp/observability-dispatch.json",
      dispatchedAlertCount: 2,
      criticalAlertCount: 1,
      warningAlertCount: 1,
      infoAlertCount: 0,
      completedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      operationalIntegrationId: "integration-1"
    }
  ]),
  getObservabilityAutomationStatus: vi.fn(async () => ({
    scheduleMode: "interval",
    intervalMinutes: 20,
    startupDelaySeconds: 45,
    actorUserEmail: "operator-admin@atlas.local",
    minimumSeverity: "warning",
    dispatchAlerts: false,
    dispatchMode: "command",
    dispatchProvider: "generic-webhook",
    dispatchDeliveryKind: "alert-dispatch",
    triggerIncidents: true,
    retention: {
      snapshotRetentionDays: 30,
      dispatchRetentionDays: 30,
      incidentRetentionDays: 30,
      automationRetentionDays: 30
    },
    lastRunAt: new Date().toISOString(),
    lastRunStatus: "SUCCEEDED",
    lastReportPath: "/tmp/observability-automation.json",
    recentRuns: [
      {
        id: "/tmp/observability-automation.json",
        status: "SUCCEEDED",
        trigger: "scheduled",
        generatedAt: new Date().toISOString(),
        actorUserEmail: "operator-admin@atlas.local",
        reason: "Run scheduled observability automation for the current release slot.",
        minimumSeverity: "warning",
        dispatchAlerts: false,
        triggerIncidents: true,
        alertCount: 2,
        activeIncidentCount: 1,
        snapshotId: "snapshot-1",
        dispatchId: null,
        workerTelemetryStatus: "warning",
        reportPath: "/tmp/observability-automation.json",
        errorMessage: null
      }
    ]
  })),
  listObservabilityAutomationRuns: vi.fn(async () => [
    {
      id: "/tmp/observability-automation.json",
      status: "SUCCEEDED",
      trigger: "scheduled",
      generatedAt: new Date().toISOString(),
      actorUserEmail: "operator-admin@atlas.local",
      reason: "Run scheduled observability automation for the current release slot.",
      minimumSeverity: "warning",
      dispatchAlerts: false,
      triggerIncidents: true,
      alertCount: 2,
      activeIncidentCount: 1,
      snapshotId: "snapshot-1",
      dispatchId: null,
      workerTelemetryStatus: "warning",
      reportPath: "/tmp/observability-automation.json",
      errorMessage: null
    }
  ]),
  listObservabilityIncidentTriggers: vi.fn(async () => [
    {
      id: "incident-trigger-1",
      dedupeKey: "staging:operator-critical-cases",
      appEnv: "staging",
      releaseStage: "private-beta",
      source: "operator",
      severity: "critical",
      status: "ACTIVE",
      title: "Critical operator cases are open",
      summary: "1 critical case currently requires immediate investigation.",
      alertIds: ["operator-critical-cases"],
      traceIds: ["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
      actorUserEmail: "operator-admin@atlas.local",
      reportPath: "/tmp/observability-incident.json",
      resolvedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ]),
  readPublishedWorkerTelemetry: vi.fn(() => ({
    status: "warning",
    summary: "1 worker job failures are currently recorded.",
    snapshotPath: "/tmp/worker-runtime.json",
    recordedAt: new Date().toISOString(),
    staleAfterMinutes: 10,
    snapshot: {
      service: "worker",
      startedAt: new Date().toISOString(),
      recordedAt: new Date().toISOString(),
      uptimeSeconds: 120,
      revision: "rev-123",
      deploymentSlot: "blue",
      queueCount: 2,
      readyQueueCount: 2,
      processedCount: 12,
      failedCount: 1,
      traceCount: 12,
      traceCoverageRate: 1,
      queues: [
        {
          key: "payments-execution",
          name: "atlas-phase-0-payments-execution",
          readyCount: 1,
          processedCount: 8,
          failedCount: 1,
          lastProcessedAt: new Date().toISOString(),
          lastFailedAt: new Date().toISOString()
        }
      ],
      recentTraces: []
    }
  }))
}));

vi.mock("@atlas/database", async () => {
  const actual = await vi.importActual<typeof import("@atlas/database")>("@atlas/database");

  return {
    ...actual,
    listBuyerAgents: databaseMock.listBuyerAgents,
    createBuyerAgent: databaseMock.createBuyerAgent,
    updateBuyerAgent: databaseMock.updateBuyerAgent,
    listBuyerPolicies: databaseMock.listBuyerPolicies,
    createBuyerPolicy: databaseMock.createBuyerPolicy,
    updateBuyerPolicy: databaseMock.updateBuyerPolicy,
    listBuyerRequests: databaseMock.listBuyerRequests,
    createBuyerRequest: databaseMock.createBuyerRequest,
    listBuyerApprovals: databaseMock.listBuyerApprovals,
    decideBuyerApproval: databaseMock.decideBuyerApproval,
    getBuyerApprovalRoleGuard: databaseMock.getBuyerApprovalRoleGuard,
    getSellerProfile: databaseMock.getSellerProfile,
    listSellerTeamMembers: databaseMock.listSellerTeamMembers,
    listSellerRequests: databaseMock.listSellerRequests,
    getSellerAnalytics: databaseMock.getSellerAnalytics,
    listSellerServices: databaseMock.listSellerServices,
    getSellerService: databaseMock.getSellerService,
    createSellerService: databaseMock.createSellerService,
    updateSellerService: databaseMock.updateSellerService,
    recordSellerRequestFulfillment: databaseMock.recordSellerRequestFulfillment,
    listPaymentIntents: databaseMock.listPaymentIntents,
    getPaymentIntent: databaseMock.getPaymentIntent,
    executeBuyerPayment: databaseMock.executeBuyerPayment,
    getOrganizationProgrammableSettlement: databaseMock.getOrganizationProgrammableSettlement,
    listOrganizationWallets: databaseMock.listOrganizationWallets,
    createOrganizationWallet: databaseMock.createOrganizationWallet,
    updateOrganizationProgrammableSettlementSettings:
      databaseMock.updateOrganizationProgrammableSettlementSettings,
    listProgrammableSettlementOrganizations: databaseMock.listProgrammableSettlementOrganizations,
    verifyOrganizationWallet: databaseMock.verifyOrganizationWallet,
    listExternalIdentityAssignments: databaseMock.listExternalIdentityAssignments,
    listOperationalIntegrations: databaseMock.listOperationalIntegrations,
    listObservabilitySnapshots: databaseMock.listObservabilitySnapshots,
    listObservabilityAlertDispatches: databaseMock.listObservabilityAlertDispatches,
    getObservabilityAutomationStatus: databaseMock.getObservabilityAutomationStatus,
    listObservabilityAutomationRuns: databaseMock.listObservabilityAutomationRuns,
    listObservabilityIncidentTriggers: databaseMock.listObservabilityIncidentTriggers,
    readPublishedWorkerTelemetry: databaseMock.readPublishedWorkerTelemetry,
    listAtlasRolloutAutomationSummary: databaseMock.listAtlasRolloutAutomationSummary,
    listAtlasRestoreDrillReports: databaseMock.listAtlasRestoreDrillReports,
    listAtlasSecretRotationExecutionReports: databaseMock.listAtlasSecretRotationExecutionReports,
    listAtlasPromotionExecutionReports: databaseMock.listAtlasPromotionExecutionReports,
    getOperationalExecutionSummary: databaseMock.getOperationalExecutionSummary,
    listOperationalExecutions: databaseMock.listOperationalExecutions,
    listAtlasUpstreamIdentityLifecycleReports: databaseMock.listAtlasUpstreamIdentityLifecycleReports,
    executeAtlasUpstreamIdentityLifecycle: databaseMock.executeAtlasUpstreamIdentityLifecycle,
    provisionExternalIdentityAssignment: databaseMock.provisionExternalIdentityAssignment,
    updateExternalIdentityAssignmentLifecycle: databaseMock.updateExternalIdentityAssignmentLifecycle,
    listReceiptRecords: databaseMock.listReceiptRecords,
    getReceiptRecord: databaseMock.getReceiptRecord,
    getOperatorOverview: databaseMock.getOperatorOverview,
    listOperatorCases: databaseMock.listOperatorCases,
    getOperatorCase: databaseMock.getOperatorCase,
    listOperatorNotifications: databaseMock.listOperatorNotifications,
    performOperatorCaseAction: databaseMock.performOperatorCaseAction,
    listOperatorAuditEvents: databaseMock.listOperatorAuditEvents,
    getBuyerAnalytics: databaseMock.getBuyerAnalytics,
    getBuyerAnalyticsForActor: databaseMock.getBuyerAnalytics,
    listBuyerRequestAnalytics: databaseMock.listBuyerRequestAnalytics,
    listBuyerRequestAnalyticsForActor: databaseMock.listBuyerRequestAnalytics,
    listBuyerActivityAnalytics: databaseMock.listBuyerActivityAnalytics,
    listBuyerActivityAnalyticsForActor: databaseMock.listBuyerActivityAnalytics,
    exportBuyerRequestCsv: databaseMock.exportBuyerRequestCsv,
    exportBuyerRequestCsvForActor: databaseMock.exportBuyerRequestCsv,
    getSellerRevenueAnalytics: databaseMock.getSellerRevenueAnalytics,
    getSellerRevenueAnalyticsForActor: databaseMock.getSellerRevenueAnalytics,
    listSellerRequestAnalytics: databaseMock.listSellerRequestAnalytics,
    listSellerRequestAnalyticsForActor: databaseMock.listSellerRequestAnalytics,
    exportSellerRequestCsv: databaseMock.exportSellerRequestCsv,
    exportSellerRequestCsvForActor: databaseMock.exportSellerRequestCsv,
    getPlatformAnalytics: databaseMock.getPlatformAnalytics,
    getPlatformAnalyticsForActor: databaseMock.getPlatformAnalytics,
    listPlatformTransactions: databaseMock.listPlatformTransactions,
    listPlatformTransactionsForActor: databaseMock.listPlatformTransactions,
    listPlatformOrganizations: databaseMock.listPlatformOrganizations,
    listPlatformOrganizationsForActor: databaseMock.listPlatformOrganizations,
    exportPlatformTransactionCsv: databaseMock.exportPlatformTransactionCsv,
    exportPlatformTransactionCsvForActor: databaseMock.exportPlatformTransactionCsv
  };
});

function createActor(
  workspace: AtlasActorContext["workspace"],
  role: AtlasActorContext["membership"]["role"],
  overrides: Partial<AtlasActorContext> = {}
): AtlasActorContext {
  return {
    user: {
      id: `user-${workspace.toLowerCase()}`,
      email: `${workspace.toLowerCase()}@atlas.local`,
      name: `${workspace} Tester`
    },
    organization: {
      id: `org-${workspace.toLowerCase()}`,
      slug: `atlas-${workspace.toLowerCase()}`,
      name: `${workspace} Organization`,
      kind: workspace
    },
    membership: {
      id: `membership-${workspace.toLowerCase()}`,
      role
    },
    workspace,
    agentId: null,
    source: "local-development",
    providerMode: "local-signed",
    sessionId: null,
    ...overrides
  };
}

describe("atlas api e2e", () => {
  let app: INestApplication;
  const actorResolutionServiceMock = {
    readSessionHeader: vi.fn((headers: Record<string, string | string[] | undefined>) => headers["x-atlas-local-session"]),
    resolveFromHeaders: vi.fn(async () => ({
      status: "missing" as const,
      message: "Missing signed actor session header"
    })),
    resolveFromHeader: vi.fn(async () => ({
      status: "missing" as const,
      message: "Missing signed actor session header"
    }))
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(ActorResolutionService)
      .useValue(actorResolutionServiceMock)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    actorResolutionServiceMock.readSessionHeader.mockClear();
    actorResolutionServiceMock.resolveFromHeader.mockReset();
    actorResolutionServiceMock.resolveFromHeaders.mockReset();
    actorResolutionServiceMock.resolveFromHeader.mockResolvedValue({
      status: "missing",
      message: "Missing signed actor session header"
    });
    actorResolutionServiceMock.resolveFromHeaders.mockImplementation((headers: Record<string, string | string[] | undefined>) =>
      actorResolutionServiceMock.resolveFromHeader(headers)
    );
    for (const mockFn of Object.values(databaseMock)) {
      mockFn.mockClear();
    }
  });

  afterAll(async () => {
    await app?.close();
  });

  it("serves health without actor context", async () => {
    const response = await request(app.getHttpServer()).get("/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.service).toBe("api");
    expect(response.body.appEnv).toEqual(expect.any(String));
    expect(response.headers["x-atlas-request-id"]).toEqual(expect.any(String));
    expect(response.headers["x-atlas-trace-id"]).toMatch(/^[0-9a-f]{32}$/);
    expect(response.headers["traceparent"]).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
  });

  it("serves live, startup, and readiness operations endpoints", async () => {
    const liveResponse = await request(app.getHttpServer()).get("/health/live");
    const startupResponse = await request(app.getHttpServer()).get("/health/startup");
    const readinessResponse = await request(app.getHttpServer()).get("/health/ready");
    const metricsResponse = await request(app.getHttpServer()).get("/health/metrics");

    expect(liveResponse.status).toBe(200);
    expect(liveResponse.body).toMatchObject({
      status: "ok",
      service: "api",
      appEnv: expect.any(String),
      releaseStage: expect.any(String)
    });

    expect(startupResponse.status).toBe(200);
    expect(startupResponse.body).toMatchObject({
      status: "started",
      service: "api",
      verificationCommand: "pnpm verify:release",
      revision: expect.any(String),
      deploymentSlot: expect.any(String),
      configurationStatus: "invalid",
      requiredVariables: expect.any(Array)
    });
    expect(startupResponse.body.requiredVariables).toContain("DATABASE_URL");

    expect(readinessResponse.status).toBe(200);
    expect(readinessResponse.body).toMatchObject({
      status: "ready",
      service: "api",
      checks: [
        expect.objectContaining({ dependency: "database", status: "skipped" }),
        expect.objectContaining({ dependency: "redis", status: "skipped" }),
        expect.objectContaining({ dependency: "object-storage", status: "skipped" })
      ]
    });

    expect(metricsResponse.status).toBe(200);
    expect(metricsResponse.body).toMatchObject({
      item: expect.objectContaining({
        service: "api",
        totalRequests: expect.any(Number),
        routeMetrics: expect.any(Array),
        configurationStatus: expect.any(String)
      })
    });
  });

  it("lists the registered module map", async () => {
    const response = await request(app.getHttpServer()).get("/platform/modules");

    expect(response.status).toBe(200);
    expect(response.body.modules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          module: expect.objectContaining({
            key: "identity"
          })
        }),
        expect.objectContaining({
          module: expect.objectContaining({
            key: "payments"
          })
        })
      ])
    );
  });

  it("lists the registered queue map", async () => {
    const response = await request(app.getHttpServer()).get("/platform/queues");

    expect(response.status).toBe(200);
    expect(response.body.queues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          queue: expect.objectContaining({
            key: "approvals-routing",
            family: "approvals"
          })
        }),
        expect.objectContaining({
          queue: expect.objectContaining({
            key: "payments-execution",
            family: "payments"
          })
        })
      ])
    );
  });

  it("returns unauthorized when a protected route has no actor header", async () => {
    const response = await request(app.getHttpServer()).get("/identity/session");

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Missing signed actor session header");
  });

  it("returns service unavailable when actor resolution is not available", async () => {
    actorResolutionServiceMock.resolveFromHeaders.mockResolvedValue({
      status: "unavailable",
      message: "Database is unavailable"
    });

    const response = await request(app.getHttpServer())
      .get("/identity/session")
      .set("x-atlas-local-session", "local-token");

    expect(response.status).toBe(503);
    expect(response.body.message).toBe("Database is unavailable");
  });

  it("enforces workspace boundaries for buyer-only modules", async () => {
    actorResolutionServiceMock.resolveFromHeaders.mockResolvedValue({
      status: "ready",
      selection: {
        profileKey: "seller-admin",
        workspace: "SELLER",
        userEmail: "seller@atlas.local",
        organizationSlug: "atlas-demo-seller",
        role: "ADMIN",
        agentId: null
      },
      actor: createActor("SELLER", "ADMIN")
    });

    const response = await request(app.getHttpServer())
      .get("/agents/summary")
      .set("x-atlas-local-session", "local-token");

    expect(response.status).toBe(403);
    expect(response.body.message).toBe("Actor does not have access to this workspace");
  });

  it("serves operator external identity assignments through guarded identity routes", async () => {
    actorResolutionServiceMock.resolveFromHeaders.mockResolvedValue({
      status: "ready",
      selection: {
        profileKey: "operator-admin",
        workspace: "OPERATOR",
        userEmail: "operator-admin@atlas.local",
        organizationSlug: "atlas-demo-operator",
        role: "ADMIN",
        agentId: null
      },
      actor: createActor("OPERATOR", "ADMIN")
    });

    const response = await request(app.getHttpServer())
      .get("/identity/external-assignments")
      .set("x-atlas-local-session", "local-token");

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([
      expect.objectContaining({
        id: "assignment-1",
        externalEmail: "buyer-admin@example.com",
        status: "ACTIVE"
      })
    ]);
  });

  it("provisions external identity assignments through guarded identity routes", async () => {
    actorResolutionServiceMock.resolveFromHeaders.mockResolvedValue({
      status: "ready",
      selection: {
        profileKey: "operator-admin",
        workspace: "OPERATOR",
        userEmail: "operator-admin@atlas.local",
        organizationSlug: "atlas-demo-operator",
        role: "ADMIN",
        agentId: null
      },
      actor: createActor("OPERATOR", "ADMIN")
    });

    const response = await request(app.getHttpServer())
      .post("/identity/external-assignments")
      .set("x-atlas-local-session", "local-token")
      .send({
        provider: "okta-design-partner",
        externalEmail: "seller-admin@example.com",
        targetOrganizationSlug: "atlas-demo-seller",
        targetRole: "ADMIN",
        userName: "Seller Admin",
        reason: "Provision seller administrator for rollout validation.",
        syncUpstream: true
      });

    expect(response.status).toBe(201);
    expect(response.body.item).toMatchObject({
      id: "assignment-created",
      organizationSlug: "atlas-demo-seller",
      role: "ADMIN"
    });
    expect(response.body.upstream).toMatchObject({
      reportPath: "/tmp/upstream.json"
    });
  });

  it("updates external identity assignment lifecycle through guarded identity routes", async () => {
    actorResolutionServiceMock.resolveFromHeaders.mockResolvedValue({
      status: "ready",
      selection: {
        profileKey: "operator-admin",
        workspace: "OPERATOR",
        userEmail: "operator-admin@atlas.local",
        organizationSlug: "atlas-demo-operator",
        role: "ADMIN",
        agentId: null
      },
      actor: createActor("OPERATOR", "ADMIN")
    });

    const response = await request(app.getHttpServer())
      .post("/identity/external-assignments/assignment-1/lifecycle")
      .set("x-atlas-local-session", "local-token")
      .send({
        action: "SUSPEND",
        reason: "Temporarily suspend external access while tenant mapping is reviewed.",
        syncUpstream: true
      });

    expect(response.status).toBe(201);
    expect(response.body.assignment).toMatchObject({
      id: "assignment-1",
      status: "SUSPENDED"
    });
    expect(response.body.revokedSessionCount).toBe(1);
    expect(response.body.upstream).toMatchObject({
      reportPath: "/tmp/upstream.json"
    });
  });

  it("allows shared modules for supported workspaces", async () => {
    actorResolutionServiceMock.resolveFromHeader.mockResolvedValue({
      status: "ready",
      selection: {
        profileKey: "seller-admin",
        workspace: "SELLER",
        userEmail: "seller@atlas.local",
        organizationSlug: "atlas-demo-seller",
        role: "ADMIN",
        agentId: null
      },
      actor: createActor("SELLER", "ADMIN")
    });

    const response = await request(app.getHttpServer())
      .get("/payments/summary")
      .set("x-atlas-local-session", "local-token");

    expect(response.status).toBe(200);
    expect(response.body.module).toMatchObject({
      key: "payments",
      workspace: "SELLER"
    });
  });

  it("blocks support-access sessions from write routes", async () => {
    actorResolutionServiceMock.resolveFromHeader.mockResolvedValue({
      status: "ready",
      selection: {
        profileKey: "operator-operator",
        workspace: "OPERATOR",
        userEmail: "operator@atlas.local",
        organizationSlug: "atlas-demo-operator",
        role: "OPERATOR",
        agentId: null
      },
      actor: createActor("BUYER", "OPERATOR", {
        source: "internal-support",
        principalOrganization: {
          id: "org-operator",
          slug: "atlas-demo-operator",
          name: "Atlas Demo Operator",
          kind: "OPERATOR"
        },
        supportAccess: {
          mode: "read-only",
          reason: "Inspect a delayed payment and receipt mismatch.",
          grantedByUserEmail: "operator@atlas.local",
          targetOrganizationSlug: "atlas-demo-buyer",
          targetWorkspace: "BUYER"
        }
      })
    });

    const response = await request(app.getHttpServer())
      .post("/requests")
      .set("x-atlas-local-session", "local-token")
      .send({
        agentId: "agent-1",
        title: "Blocked support write",
        purpose: "A support session should not be able to submit buyer writes.",
        sellerOrganizationId: "seller-1",
        serviceCategory: "api-access",
        amountMinor: 1200,
        currency: "USD"
      });

    expect(response.status).toBe(403);
    expect(response.body.message).toBe("Support-access sessions are limited to read-only routes");
  });

  it("serves buyer analytics and exports through guarded analytics routes", async () => {
    actorResolutionServiceMock.resolveFromHeader.mockResolvedValue({
      status: "ready",
      selection: {
        profileKey: "buyer-admin",
        workspace: "BUYER",
        userEmail: "buyer-admin@atlas.local",
        organizationSlug: "atlas-demo-buyer",
        role: "ADMIN",
        agentId: null
      },
      actor: createActor("BUYER", "ADMIN")
    });

    const overviewResponse = await request(app.getHttpServer())
      .get("/analytics/buyer/overview")
      .set("x-atlas-local-session", "local-token");
    const requestsResponse = await request(app.getHttpServer())
      .get("/analytics/buyer/requests")
      .set("x-atlas-local-session", "local-token");
    const activityResponse = await request(app.getHttpServer())
      .get("/analytics/buyer/activity")
      .set("x-atlas-local-session", "local-token");
    const exportResponse = await request(app.getHttpServer())
      .get("/analytics/buyer/requests.csv")
      .set("x-atlas-local-session", "local-token");

    expect(overviewResponse.status).toBe(200);
    expect(overviewResponse.body.item).toMatchObject({
      totalSpendMinor: 12400,
      requestCount: 4
    });

    expect(requestsResponse.status).toBe(200);
    expect(requestsResponse.body.items).toEqual([
      expect.objectContaining({
        id: "request-created",
        reconciliationState: "RECEIPT_AVAILABLE"
      })
    ]);

    expect(activityResponse.status).toBe(200);
    expect(activityResponse.body.items).toEqual([
      expect.objectContaining({
        id: "audit-buyer-1",
        eventType: "request_created"
      })
    ]);

    expect(exportResponse.status).toBe(200);
    expect(exportResponse.text).toContain("Request ID,Title");
    expect(exportResponse.headers["content-type"]).toContain("text/csv");
  });

  it("serves seller and platform analytics through guarded analytics routes", async () => {
    actorResolutionServiceMock.resolveFromHeader.mockResolvedValue({
      status: "ready",
      selection: {
        profileKey: "seller-admin",
        workspace: "SELLER",
        userEmail: "seller@atlas.local",
        organizationSlug: "atlas-demo-seller",
        role: "ADMIN",
        agentId: null
      },
      actor: createActor("SELLER", "ADMIN")
    });

    const sellerOverviewResponse = await request(app.getHttpServer())
      .get("/analytics/seller/overview")
      .set("x-atlas-local-session", "local-token");

    expect(sellerOverviewResponse.status).toBe(200);
    expect(sellerOverviewResponse.body.item).toMatchObject({
      totalRevenueMinor: 18900,
      requestCount: 5
    });

    actorResolutionServiceMock.resolveFromHeader.mockResolvedValue({
      status: "ready",
      selection: {
        profileKey: "operator-admin",
        workspace: "OPERATOR",
        userEmail: "operator@atlas.local",
        organizationSlug: "atlas-operator",
        role: "ADMIN",
        agentId: null
      },
      actor: createActor("OPERATOR", "ADMIN")
    });

    const platformOverviewResponse = await request(app.getHttpServer())
      .get("/analytics/platform/overview")
      .set("x-atlas-local-session", "local-token");
    const platformTransactionsResponse = await request(app.getHttpServer())
      .get("/analytics/platform/transactions")
      .set("x-atlas-local-session", "local-token");
    const organizationsResponse = await request(app.getHttpServer())
      .get("/analytics/platform/organizations")
      .set("x-atlas-local-session", "local-token");
    const exportResponse = await request(app.getHttpServer())
      .get("/analytics/platform/transactions.csv")
      .set("x-atlas-local-session", "local-token");

    expect(platformOverviewResponse.status).toBe(200);
    expect(platformOverviewResponse.body.item).toMatchObject({
      activeOrganizationCount: 3,
      totalRequestCount: 7
    });

    expect(platformTransactionsResponse.status).toBe(200);
    expect(platformTransactionsResponse.body.items).toEqual([
      expect.objectContaining({
        id: "request-created",
        paymentStatus: "CAPTURED"
      })
    ]);

    expect(organizationsResponse.status).toBe(200);
    expect(organizationsResponse.body.items).toEqual([
      expect.objectContaining({
        organizationId: "org-buyer",
        organizationKind: "BUYER"
      })
    ]);

    expect(exportResponse.status).toBe(200);
    expect(exportResponse.text).toContain("Request ID,Request Title");
  });

  it("returns bad request when analytics filters are invalid", async () => {
    actorResolutionServiceMock.resolveFromHeader.mockResolvedValue({
      status: "ready",
      selection: {
        profileKey: "buyer-admin",
        workspace: "BUYER",
        userEmail: "buyer-admin@atlas.local",
        organizationSlug: "atlas-demo-buyer",
        role: "ADMIN",
        agentId: null
      },
      actor: createActor("BUYER", "ADMIN")
    });
    databaseMock.listBuyerRequestAnalytics.mockRejectedValueOnce(
      new AtlasAnalyticsReportingError("Minimum amount cannot exceed the maximum amount.", "bad_request")
    );

    const response = await request(app.getHttpServer())
      .get("/analytics/buyer/requests?minAmountMinor=5000&maxAmountMinor=1000")
      .set("x-atlas-local-session", "local-token");

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Minimum amount cannot exceed the maximum amount.");
  });

  it("lists buyer-visible payments and executes buyer payment attempts", async () => {
    actorResolutionServiceMock.resolveFromHeader.mockResolvedValue({
      status: "ready",
      selection: {
        profileKey: "buyer-admin",
        workspace: "BUYER",
        userEmail: "buyer-admin@atlas.local",
        organizationSlug: "atlas-demo-buyer",
        role: "ADMIN",
        agentId: null
      },
      actor: createActor("BUYER", "ADMIN")
    });

    const [listResponse, getResponse, executeResponse] = await Promise.all([
      request(app.getHttpServer()).get("/payments").set("x-atlas-local-session", "local-token"),
      request(app.getHttpServer()).get("/payments/payment-1").set("x-atlas-local-session", "local-token"),
      request(app.getHttpServer())
        .post("/payments/requests/request-created/execute")
        .set("x-atlas-local-session", "local-token")
        .send({
          rail: "INTERNAL_SIMULATED"
        })
    ]);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.items).toEqual([
      expect.objectContaining({
        id: "payment-1",
        rail: "INTERNAL_SIMULATED",
        latestAttemptStatus: "CAPTURED",
        reconciliationState: "RECEIPT_AVAILABLE",
        retryEligible: false
      })
    ]);

    expect(getResponse.status).toBe(200);
    expect(getResponse.body.item).toMatchObject({
      id: "payment-1",
      status: "CAPTURED",
      requestStatus: "COMPLETED",
      receiptStatus: "AVAILABLE",
      sellerFulfillmentStatus: "DELIVERED",
      attempts: [
        expect.objectContaining({
          providerStatus: "captured"
        })
      ]
    });

    expect(executeResponse.status).toBe(201);
    expect(executeResponse.body.item).toMatchObject({
      id: "payment-executed",
      rail: "INTERNAL_SIMULATED",
      status: "CAPTURED"
    });
  });

  it("returns conflict when buyer payment execution is not retry eligible", async () => {
    actorResolutionServiceMock.resolveFromHeader.mockResolvedValue({
      status: "ready",
      selection: {
        profileKey: "buyer-admin",
        workspace: "BUYER",
        userEmail: "buyer-admin@atlas.local",
        organizationSlug: "atlas-demo-buyer",
        role: "ADMIN",
        agentId: null
      },
      actor: createActor("BUYER", "ADMIN")
    });
    databaseMock.executeBuyerPayment.mockRejectedValueOnce(
      new AtlasPaymentsWorkflowError("A payment already exists for this request and is not currently retry eligible.", "conflict")
    );

    const response = await request(app.getHttpServer())
      .post("/payments/requests/request-created/execute")
      .set("x-atlas-local-session", "local-token")
      .send({
        rail: "INTERNAL_SIMULATED"
      });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe("A payment already exists for this request and is not currently retry eligible.");
  });

  it("executes the stripe rail through the protected buyer payment route", async () => {
    actorResolutionServiceMock.resolveFromHeader.mockResolvedValue({
      status: "ready",
      selection: {
        profileKey: "buyer-admin",
        workspace: "BUYER",
        userEmail: "buyer-admin@atlas.local",
        organizationSlug: "atlas-demo-buyer",
        role: "ADMIN",
        agentId: null
      },
      actor: createActor("BUYER", "ADMIN")
    });
    databaseMock.executeBuyerPayment.mockResolvedValueOnce({
      id: "payment-stripe",
      requestId: "request-created",
      buyerOrganizationId: "org-buyer",
      buyerOrganizationName: "Atlas Demo Buyer",
      sellerOrganizationId: "org-seller",
      sellerOrganizationName: "Atlas Demo Seller",
      rail: "STRIPE",
      status: "PENDING",
      provider: "stripe",
      reference: "pi_test_123",
      amountMinor: 2400,
      currency: "USD",
      latestAttemptNumber: 1,
      latestAttemptStatus: "PENDING",
      requestStatus: "EXECUTING",
      receiptStatus: "PENDING",
      sellerFulfillmentStatus: null,
      retryEligible: false,
      reconciliationState: "AWAITING_PAYMENT_METHOD",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attempts: [
        {
          id: "attempt-stripe-1",
          paymentId: "payment-stripe",
          attemptNumber: 1,
          rail: "STRIPE",
          status: "PENDING",
          reference: "pi_test_123",
          providerStatus: "requires_payment_method",
          evidence: {
            providerStatus: "requires_payment_method",
            paymentIntentId: "pi_test_123"
          },
          errorCode: null,
          errorMessage: null,
          createdAt: new Date().toISOString()
        }
      ]
    });

    const response = await request(app.getHttpServer())
      .post("/payments/requests/request-created/execute")
      .set("x-atlas-local-session", "local-token")
      .send({
        rail: "STRIPE"
      });

    expect(response.status).toBe(201);
    expect(response.body.item).toMatchObject({
      id: "payment-stripe",
      rail: "STRIPE",
      provider: "stripe",
      reconciliationState: "AWAITING_PAYMENT_METHOD"
    });
  });

  it("returns bad request when stripe execution is not configured", async () => {
    actorResolutionServiceMock.resolveFromHeader.mockResolvedValue({
      status: "ready",
      selection: {
        profileKey: "buyer-admin",
        workspace: "BUYER",
        userEmail: "buyer-admin@atlas.local",
        organizationSlug: "atlas-demo-buyer",
        role: "ADMIN",
        agentId: null
      },
      actor: createActor("BUYER", "ADMIN")
    });
    databaseMock.executeBuyerPayment.mockRejectedValueOnce(
      new AtlasPaymentsWorkflowError("Stripe rail is not configured in this environment.", "bad_request")
    );

    const response = await request(app.getHttpServer())
      .post("/payments/requests/request-created/execute")
      .set("x-atlas-local-session", "local-token")
      .send({
        rail: "STRIPE"
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Stripe rail is not configured in this environment.");
  });

  it("returns conflict when payment retries switch rails in the current baseline", async () => {
    actorResolutionServiceMock.resolveFromHeader.mockResolvedValue({
      status: "ready",
      selection: {
        profileKey: "buyer-admin",
        workspace: "BUYER",
        userEmail: "buyer-admin@atlas.local",
        organizationSlug: "atlas-demo-buyer",
        role: "ADMIN",
        agentId: null
      },
      actor: createActor("BUYER", "ADMIN")
    });
    databaseMock.executeBuyerPayment.mockRejectedValueOnce(
      new AtlasPaymentsWorkflowError("Payment retries must use the same rail during the current Phase 4 baseline.", "conflict")
    );

    const response = await request(app.getHttpServer())
      .post("/payments/requests/request-created/execute")
      .set("x-atlas-local-session", "local-token")
      .send({
        rail: "STRIPE"
      });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe("Payment retries must use the same rail during the current Phase 4 baseline.");
  });

  it("executes the programmable USDC rail through the protected buyer payment route", async () => {
    actorResolutionServiceMock.resolveFromHeader.mockResolvedValue({
      status: "ready",
      selection: {
        profileKey: "buyer-admin",
        workspace: "BUYER",
        userEmail: "buyer-admin@atlas.local",
        organizationSlug: "atlas-demo-buyer",
        role: "ADMIN",
        agentId: null
      },
      actor: createActor("BUYER", "ADMIN")
    });
    databaseMock.executeBuyerPayment.mockResolvedValueOnce({
      id: "payment-programmable",
      requestId: "request-created",
      buyerOrganizationId: "org-buyer",
      buyerOrganizationName: "Atlas Demo Buyer",
      sellerOrganizationId: "org-seller",
      sellerOrganizationName: "Atlas Demo Seller",
      rail: "PROGRAMMABLE_USDC",
      status: "CAPTURED",
      provider: "programmable-usdc",
      reference: "0xabc123",
      amountMinor: 2400,
      currency: "USD",
      latestAttemptNumber: 1,
      latestAttemptStatus: "CAPTURED",
      requestStatus: "EXECUTING",
      receiptStatus: "PENDING",
      sellerFulfillmentStatus: null,
      retryEligible: false,
      reconciliationState: "AWAITING_SELLER_CONFIRMATION",
      chainLabel: "Base Sepolia",
      assetSymbol: "USDC",
      transactionHash: "0xabc123",
      confirmations: 2,
      buyerWalletAddress: "0x1111111111111111111111111111111111111111",
      sellerWalletAddress: "0x2222222222222222222222222222222222222222",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attempts: [
        {
          id: "attempt-programmable-1",
          paymentId: "payment-programmable",
          attemptNumber: 1,
          rail: "PROGRAMMABLE_USDC",
          status: "CAPTURED",
          reference: "0xabc123",
          providerStatus: "confirmed",
          evidence: {
            providerStatus: "confirmed",
            chain: "BASE_SEPOLIA",
            assetSymbol: "USDC",
            transactionHash: "0xabc123",
            confirmations: 2
          },
          chainLabel: "Base Sepolia",
          transactionHash: "0xabc123",
          confirmations: 2,
          errorCode: null,
          errorMessage: null,
          createdAt: new Date().toISOString()
        }
      ]
    });

    const response = await request(app.getHttpServer())
      .post("/payments/requests/request-created/execute")
      .set("x-atlas-local-session", "local-token")
      .send({
        rail: "PROGRAMMABLE_USDC"
      });

    expect(response.status).toBe(201);
    expect(response.body.item).toMatchObject({
      id: "payment-programmable",
      rail: "PROGRAMMABLE_USDC",
      provider: "programmable-usdc",
      chainLabel: "Base Sepolia",
      transactionHash: "0xabc123"
    });
  });

  it("returns conflict when programmable settlement lacks a verified wallet posture", async () => {
    actorResolutionServiceMock.resolveFromHeader.mockResolvedValue({
      status: "ready",
      selection: {
        profileKey: "buyer-admin",
        workspace: "BUYER",
        userEmail: "buyer-admin@atlas.local",
        organizationSlug: "atlas-demo-buyer",
        role: "ADMIN",
        agentId: null
      },
      actor: createActor("BUYER", "ADMIN")
    });
    databaseMock.executeBuyerPayment.mockRejectedValueOnce(
      new AtlasPaymentsWorkflowError(
        "The buyer organization needs a verified default wallet before programmable settlement can execute.",
        "conflict"
      )
    );

    const response = await request(app.getHttpServer())
      .post("/payments/requests/request-created/execute")
      .set("x-atlas-local-session", "local-token")
      .send({
        rail: "PROGRAMMABLE_USDC"
      });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe(
      "The buyer organization needs a verified default wallet before programmable settlement can execute."
    );
  });

  it("lists and fetches receipts through shared protected routes", async () => {
    actorResolutionServiceMock.resolveFromHeader.mockResolvedValue({
      status: "ready",
      selection: {
        profileKey: "seller-admin",
        workspace: "SELLER",
        userEmail: "seller@atlas.local",
        organizationSlug: "atlas-demo-seller",
        role: "ADMIN",
        agentId: null
      },
      actor: createActor("SELLER", "ADMIN")
    });

    const [listResponse, getResponse] = await Promise.all([
      request(app.getHttpServer()).get("/receipts").set("x-atlas-local-session", "local-token"),
      request(app.getHttpServer()).get("/receipts/receipt-1").set("x-atlas-local-session", "local-token")
    ]);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.items).toEqual([
      expect.objectContaining({
        id: "receipt-1",
        status: "AVAILABLE",
        reconciliationState: "RECEIPT_AVAILABLE",
        providerStatus: "captured"
      })
    ]);

    expect(getResponse.status).toBe(200);
    expect(getResponse.body.item).toMatchObject({
      id: "receipt-1",
      paymentReference: "sim-request-created-captured-01",
      paymentStatus: "CAPTURED",
      rail: "INTERNAL_SIMULATED",
      sellerOrganizationName: "Atlas Demo Seller",
      evidenceSummary: expect.arrayContaining(["Reconciliation Receipt Available", "Seller Delivered"])
    });
  });

  it("serves programmable-settlement organization and wallet routes for buyer and seller workspaces", async () => {
    actorResolutionServiceMock.resolveFromHeader.mockResolvedValue({
      status: "ready",
      selection: {
        profileKey: "buyer-admin",
        workspace: "BUYER",
        userEmail: "buyer-admin@atlas.local",
        organizationSlug: "atlas-demo-buyer",
        role: "ADMIN",
        agentId: null
      },
      actor: createActor("BUYER", "ADMIN")
    });

    const summaryResponse = await request(app.getHttpServer())
      .get("/programmable-settlement/summary")
      .set("x-atlas-local-session", "local-token");
    const chainsResponse = await request(app.getHttpServer())
      .get("/programmable-settlement/chains")
      .set("x-atlas-local-session", "local-token");
    const organizationResponse = await request(app.getHttpServer())
      .get("/programmable-settlement/organization")
      .set("x-atlas-local-session", "local-token");
    const walletsResponse = await request(app.getHttpServer())
      .get("/programmable-settlement/wallets")
      .set("x-atlas-local-session", "local-token");
    const createWalletResponse = await request(app.getHttpServer())
      .post("/programmable-settlement/wallets")
      .set("x-atlas-local-session", "local-token")
      .send({
        label: "New Wallet",
        address: "0x5555555555555555555555555555555555555555",
        ownershipLabel: "New Treasury Wallet",
        chain: "BASE_SEPOLIA",
        isDefault: false
      });
    const settingsResponse = await request(app.getHttpServer())
      .patch("/programmable-settlement/settings")
      .set("x-atlas-local-session", "local-token")
      .send({
        allowedRails: ["INTERNAL_SIMULATED", "PROGRAMMABLE_USDC"],
        preferredRail: "PROGRAMMABLE_USDC"
      });

    expect(summaryResponse.status).toBe(200);
    expect(summaryResponse.body.module.key).toBe("programmable-settlement");
    expect(chainsResponse.status).toBe(200);
    expect(chainsResponse.body.items[0]).toMatchObject({
      key: "BASE_SEPOLIA",
      assetSymbol: "USDC"
    });
    expect(organizationResponse.status).toBe(200);
    expect(organizationResponse.body.item).toMatchObject({
      organizationName: "Atlas Demo Buyer",
      settings: {
        preferredRail: "PROGRAMMABLE_USDC"
      }
    });
    expect(walletsResponse.status).toBe(200);
    expect(walletsResponse.body.items[0]).toMatchObject({
      verificationStatus: "VERIFIED"
    });
    expect(createWalletResponse.status).toBe(201);
    expect(createWalletResponse.body.item).toMatchObject({
      id: "wallet-created",
      verificationStatus: "PENDING"
    });
    expect(settingsResponse.status).toBe(200);
    expect(settingsResponse.body.item.settings.allowedRails).toEqual(["INTERNAL_SIMULATED", "PROGRAMMABLE_USDC"]);
  });

  it("serves programmable-settlement operator review and verification routes", async () => {
    actorResolutionServiceMock.resolveFromHeader.mockResolvedValue({
      status: "ready",
      selection: {
        profileKey: "operator-operator",
        workspace: "OPERATOR",
        userEmail: "operator@atlas.local",
        organizationSlug: "atlas-demo-operator",
        role: "OPERATOR",
        agentId: null
      },
      actor: createActor("OPERATOR", "OPERATOR")
    });

    const [organizationsResponse, verifyResponse] = await Promise.all([
      request(app.getHttpServer()).get("/programmable-settlement/organizations").set("x-atlas-local-session", "local-token"),
      request(app.getHttpServer())
        .patch("/programmable-settlement/wallets/wallet-buyer-primary/verification")
        .set("x-atlas-local-session", "local-token")
        .send({
          status: "VERIFIED",
          note: "Verified by operator"
        })
    ]);

    expect(organizationsResponse.status).toBe(200);
    expect(organizationsResponse.body.items[0]).toMatchObject({
      organizationName: "Atlas Demo Buyer",
      readiness: {
        ready: false
      }
    });
    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.body.item).toMatchObject({
      id: "wallet-buyer-primary",
      verificationStatus: "VERIFIED",
      verificationNote: "Verified by operator"
    });
  });

  it("returns bad request when programmable-settlement validation fails", async () => {
    actorResolutionServiceMock.resolveFromHeader.mockResolvedValue({
      status: "ready",
      selection: {
        profileKey: "buyer-admin",
        workspace: "BUYER",
        userEmail: "buyer-admin@atlas.local",
        organizationSlug: "atlas-demo-buyer",
        role: "ADMIN",
        agentId: null
      },
      actor: createActor("BUYER", "ADMIN")
    });
    databaseMock.createOrganizationWallet.mockRejectedValueOnce(
      new AtlasProgrammableSettlementError("Wallet address must be a 42-character 0x-prefixed hex value.", "bad_request")
    );

    const response = await request(app.getHttpServer())
      .post("/programmable-settlement/wallets")
      .set("x-atlas-local-session", "local-token")
      .send({
        label: "Broken Wallet",
        address: "invalid",
        ownershipLabel: "Broken Wallet",
        chain: "BASE_SEPOLIA",
        isDefault: false
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Wallet address must be a 42-character 0x-prefixed hex value.");
  });

  it("serves operator overview, cases, notifications, and audit explorer routes", async () => {
    actorResolutionServiceMock.resolveFromHeader.mockResolvedValue({
      status: "ready",
      selection: {
        profileKey: "operator-operator",
        workspace: "OPERATOR",
        userEmail: "operator@atlas.local",
        organizationSlug: "atlas-demo-operator",
        role: "OPERATOR",
        agentId: null
      },
      actor: createActor("OPERATOR", "OPERATOR")
    });

    const overviewResponse = await request(app.getHttpServer()).get("/operator-controls/overview").set("x-atlas-local-session", "local-token");
    const casesResponse = await request(app.getHttpServer()).get("/operator-controls/cases").set("x-atlas-local-session", "local-token");
    const notificationsResponse = await request(app.getHttpServer()).get("/operator-controls/notifications").set("x-atlas-local-session", "local-token");
    const auditResponse = await request(app.getHttpServer())
      .get("/audit/events")
      .query({
        query: "payment"
      })
      .set("x-atlas-local-session", "local-token");

    expect(overviewResponse.status).toBe(200);
    expect(overviewResponse.body.item).toMatchObject({
      openCaseCount: 2,
      unreadNotificationCount: 2
    });

    expect(casesResponse.status).toBe(200);
    expect(casesResponse.body.items).toEqual([
      expect.objectContaining({
        id: "case-1",
        category: "PAYMENT_FAILURE",
        availableActions: expect.arrayContaining(["REQUEUE_PAYMENT"])
      })
    ]);

    expect(notificationsResponse.status).toBe(200);
    expect(notificationsResponse.body.items).toEqual([
      expect.objectContaining({
        id: "notification-1",
        status: "UNREAD"
      })
    ]);

    expect(auditResponse.status).toBe(200);
    expect(auditResponse.body.items).toEqual([
      expect.objectContaining({
        id: "audit-1",
        targetType: "OperatorCase"
      })
    ]);
  });

  it("serves operator observability routes", async () => {
    actorResolutionServiceMock.resolveFromHeader.mockResolvedValue({
      status: "ready",
      selection: {
        profileKey: "operator-operator",
        workspace: "OPERATOR",
        userEmail: "operator@atlas.local",
        organizationSlug: "atlas-demo-operator",
        role: "OPERATOR",
        agentId: null
      },
      actor: createActor("OPERATOR", "OPERATOR")
    });

    const summaryResponse = await request(app.getHttpServer())
      .get("/observability/summary")
      .set("x-atlas-local-session", "local-token");
    const metricsResponse = await request(app.getHttpServer())
      .get("/observability/metrics")
      .set("x-atlas-local-session", "local-token");
    const alertsResponse = await request(app.getHttpServer())
      .get("/observability/alerts")
      .set("x-atlas-local-session", "local-token");
    const incidentsResponse = await request(app.getHttpServer())
      .get("/observability/incidents")
      .set("x-atlas-local-session", "local-token");
    const workerResponse = await request(app.getHttpServer())
      .get("/observability/worker")
      .set("x-atlas-local-session", "local-token");
    const snapshotsResponse = await request(app.getHttpServer())
      .get("/observability/snapshots")
      .set("x-atlas-local-session", "local-token");
    const dispatchesResponse = await request(app.getHttpServer())
      .get("/observability/dispatches")
      .set("x-atlas-local-session", "local-token");
    const automationResponse = await request(app.getHttpServer())
      .get("/observability/automation")
      .set("x-atlas-local-session", "local-token");
    const automationRunsResponse = await request(app.getHttpServer())
      .get("/observability/automation-runs")
      .set("x-atlas-local-session", "local-token");
    const incidentTriggersResponse = await request(app.getHttpServer())
      .get("/observability/incident-triggers")
      .set("x-atlas-local-session", "local-token");

    expect(summaryResponse.status).toBe(200);
    expect(summaryResponse.body.module.key).toBe("observability");
    expect(metricsResponse.status).toBe(200);
    expect(metricsResponse.body.item).toMatchObject({
      service: "api",
      routeMetrics: expect.any(Array)
    });
    expect(alertsResponse.status).toBe(200);
    expect(alertsResponse.body.items).toEqual(expect.any(Array));
    expect(incidentsResponse.status).toBe(200);
    expect(incidentsResponse.body.item).toMatchObject({
      overallStatus: expect.any(String),
      items: expect.any(Array)
    });
    expect(workerResponse.status).toBe(200);
    expect(workerResponse.body.item).toMatchObject({
      status: "warning",
      snapshot: expect.objectContaining({
        service: "worker",
        failedCount: 1
      })
    });
    expect(snapshotsResponse.status).toBe(200);
    expect(snapshotsResponse.body.items).toEqual([
      expect.objectContaining({
        id: "snapshot-1",
        activeAlertCount: 2
      })
    ]);
    expect(dispatchesResponse.status).toBe(200);
    expect(dispatchesResponse.body.items).toEqual([
      expect.objectContaining({
        id: "dispatch-1",
        provider: "generic-webhook",
        deliveryKind: "alert-dispatch",
        traceId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      })
    ]);
    expect(automationResponse.status).toBe(200);
    expect(automationResponse.body.item).toMatchObject({
      scheduleMode: "interval",
      intervalMinutes: 20,
      dispatchProvider: "generic-webhook",
      dispatchDeliveryKind: "alert-dispatch",
      lastRunStatus: "SUCCEEDED"
    });
    expect(automationRunsResponse.status).toBe(200);
    expect(automationRunsResponse.body.items).toEqual([
      expect.objectContaining({
        trigger: "scheduled",
        snapshotId: "snapshot-1"
      })
    ]);
    expect(incidentTriggersResponse.status).toBe(200);
    expect(incidentTriggersResponse.body.items).toEqual([
      expect.objectContaining({
        id: "incident-trigger-1",
        status: "ACTIVE"
      })
    ]);
  });

  it("serves operator rollout routes", async () => {
    actorResolutionServiceMock.resolveFromHeader.mockResolvedValue({
      status: "ready",
      selection: {
        profileKey: "operator-admin",
        workspace: "OPERATOR",
        userEmail: "operator@atlas.local",
        organizationSlug: "atlas-demo-operator",
        role: "ADMIN",
        agentId: null
      },
      actor: createActor("OPERATOR", "ADMIN")
    });

    const summaryResponse = await request(app.getHttpServer())
      .get("/rollout/summary")
      .set("x-atlas-local-session", "local-token");
    const integrationsResponse = await request(app.getHttpServer())
      .get("/rollout/integrations")
      .set("x-atlas-local-session", "local-token");
    const executionsResponse = await request(app.getHttpServer())
      .get("/rollout/executions")
      .set("x-atlas-local-session", "local-token");

    expect(summaryResponse.status).toBe(200);
    expect(summaryResponse.body.module.key).toBe("rollout");
    expect(summaryResponse.body.automation.upstreamIdentity.provider).toBe("okta-scim");
    expect(summaryResponse.body.executionSummary).toMatchObject({
      totalCount: 5,
      failedCount: 1
    });
    expect(integrationsResponse.status).toBe(200);
    expect(integrationsResponse.body.items).toEqual([
      expect.objectContaining({
        id: "integration-1",
        label: "staging github runner",
        verificationStatus: "VERIFIED"
      })
    ]);
    expect(executionsResponse.status).toBe(200);
    expect(executionsResponse.body.items).toEqual([
      expect.objectContaining({
        id: "execution-1",
        kind: "DEPLOYMENT_PROMOTION",
        status: "SUCCEEDED"
      })
    ]);
  });

  it("records reason-captured operator case actions through the protected operator module", async () => {
    actorResolutionServiceMock.resolveFromHeader.mockResolvedValue({
      status: "ready",
      selection: {
        profileKey: "operator-operator",
        workspace: "OPERATOR",
        userEmail: "operator@atlas.local",
        organizationSlug: "atlas-demo-operator",
        role: "OPERATOR",
        agentId: null
      },
      actor: createActor("OPERATOR", "OPERATOR")
    });

    const [detailResponse, actionResponse] = await Promise.all([
      request(app.getHttpServer()).get("/operator-controls/cases/case-1").set("x-atlas-local-session", "local-token"),
      request(app.getHttpServer())
        .post("/operator-controls/cases/case-1/actions")
        .set("x-atlas-local-session", "local-token")
        .send({
          actionType: "PAUSE_REQUEST",
          reason: "Pause this request while payment failure evidence is reviewed."
        })
    ]);

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.item).toMatchObject({
      item: expect.objectContaining({
        id: "case-1",
        category: "PAYMENT_FAILURE"
      })
    });

    expect(actionResponse.status).toBe(201);
    expect(actionResponse.body.item).toMatchObject({
      item: expect.objectContaining({
        id: "case-1",
        paused: true
      })
    });
  });

  it("lists buyer agents through the protected buyer module", async () => {
    actorResolutionServiceMock.resolveFromHeader.mockResolvedValue({
      status: "ready",
      selection: {
        profileKey: "buyer-admin",
        workspace: "BUYER",
        userEmail: "buyer-admin@atlas.local",
        organizationSlug: "atlas-demo-buyer",
        role: "ADMIN",
        agentId: null
      },
      actor: createActor("BUYER", "ADMIN")
    });
    databaseMock.listBuyerAgents.mockResolvedValueOnce([
      {
        id: "agent-1",
        name: "Procurement Agent",
        externalRef: "agent://atlas/procurement",
        purpose: "Handle bounded procurement API access.",
        status: "ACTIVE",
        policyId: "policy-1",
        policyName: "Low Risk API Access",
        requestCount: 3
      }
    ]);

    const response = await request(app.getHttpServer())
      .get("/agents")
      .set("x-atlas-local-session", "local-token");

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([
      expect.objectContaining({
        id: "agent-1",
        status: "ACTIVE"
      })
    ]);
  });

  it("creates buyer requests through the protected buyer module", async () => {
    actorResolutionServiceMock.resolveFromHeader.mockResolvedValue({
      status: "ready",
      selection: {
        profileKey: "buyer-admin",
        workspace: "BUYER",
        userEmail: "buyer-admin@atlas.local",
        organizationSlug: "atlas-demo-buyer",
        role: "ADMIN",
        agentId: null
      },
      actor: createActor("BUYER", "ADMIN")
    });

    const response = await request(app.getHttpServer())
      .post("/requests")
      .set("x-atlas-local-session", "local-token")
      .send({
        agentId: "agent-1",
        sellerOrganizationId: "seller-1",
        title: "Created Request",
        purpose: "Submit a paid request for a production buyer workflow test.",
        amountMinor: 2400,
        currency: "USD",
        serviceCategory: "api-access",
        serviceKey: "benchmark-api"
      });

    expect(response.status).toBe(201);
    expect(response.body.item).toMatchObject({
      id: "request-created",
      approvalStatus: "PENDING"
    });
    expect(databaseMock.createBuyerRequest).toHaveBeenCalledTimes(1);
  });

  it("records approval decisions through the protected buyer module", async () => {
    actorResolutionServiceMock.resolveFromHeader.mockResolvedValue({
      status: "ready",
      selection: {
        profileKey: "buyer-finance",
        workspace: "BUYER",
        userEmail: "finance@atlas.local",
        organizationSlug: "atlas-demo-buyer",
        role: "FINANCE",
        agentId: null
      },
      actor: createActor("BUYER", "FINANCE")
    });

    const response = await request(app.getHttpServer())
      .post("/approvals/approval-1/decision")
      .set("x-atlas-local-session", "local-token")
      .send({
        decision: "approve",
        decisionReason: "Within delegated approval threshold"
      });

    expect(response.status).toBe(201);
    expect(response.body.item).toMatchObject({
      id: "approval-1",
      status: "APPROVED"
    });
  });

  it("maps buyer workflow conflicts to http conflict responses", async () => {
    actorResolutionServiceMock.resolveFromHeader.mockResolvedValue({
      status: "ready",
      selection: {
        profileKey: "buyer-admin",
        workspace: "BUYER",
        userEmail: "buyer-admin@atlas.local",
        organizationSlug: "atlas-demo-buyer",
        role: "ADMIN",
        agentId: null
      },
      actor: createActor("BUYER", "ADMIN")
    });
    databaseMock.createBuyerRequest.mockRejectedValueOnce(
      new AtlasBuyerWorkflowError("The provided idempotency key is already in use.", "conflict")
    );

    const response = await request(app.getHttpServer())
      .post("/requests")
      .set("x-atlas-local-session", "local-token")
      .send({
        agentId: "agent-1",
        sellerOrganizationId: "seller-1",
        title: "Created Request",
        purpose: "Submit a paid request for a production buyer workflow test.",
        amountMinor: 2400,
        currency: "USD",
        serviceCategory: "api-access",
        serviceKey: "benchmark-api",
        idempotencyKey: "repeat-key"
      });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe("The provided idempotency key is already in use.");
  });

  it("serves seller profile and team data for seller actors", async () => {
    actorResolutionServiceMock.resolveFromHeader.mockResolvedValue({
      status: "ready",
      selection: {
        profileKey: "seller-admin",
        workspace: "SELLER",
        userEmail: "seller@atlas.local",
        organizationSlug: "atlas-demo-seller",
        role: "ADMIN",
        agentId: null
      },
      actor: createActor("SELLER", "ADMIN")
    });

    const [profileResponse, teamResponse] = await Promise.all([
      request(app.getHttpServer()).get("/sellers/profile").set("x-atlas-local-session", "local-token"),
      request(app.getHttpServer()).get("/sellers/team").set("x-atlas-local-session", "local-token")
    ]);

    expect(profileResponse.status).toBe(200);
    expect(profileResponse.body.item).toMatchObject({
      organizationSlug: "atlas-demo-seller",
      publishedServiceCount: 2
    });
    expect(teamResponse.status).toBe(200);
    expect(teamResponse.body.items).toEqual([
      expect.objectContaining({
        userEmail: "seller@atlas.local",
        role: "ADMIN"
      })
    ]);
  });

  it("lists and creates seller services through protected seller routes", async () => {
    actorResolutionServiceMock.resolveFromHeader.mockResolvedValue({
      status: "ready",
      selection: {
        profileKey: "seller-admin",
        workspace: "SELLER",
        userEmail: "seller@atlas.local",
        organizationSlug: "atlas-demo-seller",
        role: "ADMIN",
        agentId: null
      },
      actor: createActor("SELLER", "ADMIN")
    });

    const listResponse = await request(app.getHttpServer()).get("/services").set("x-atlas-local-session", "local-token");
    const createResponse = await request(app.getHttpServer())
      .post("/services")
      .set("x-atlas-local-session", "local-token")
      .send({
        key: "seller-created-service",
        name: "Created Seller Service",
        description: "Created seller service description for API coverage and seller catalog management.",
        category: "api-access",
        status: "DRAFT",
        visibility: "PRIVATE",
        pricingModel: "FIXED",
        priceMinor: 1900,
        currency: "USD"
      });

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.items).toEqual([
      expect.objectContaining({
        id: "service-1",
        key: "global-dataset-access"
      })
    ]);
    expect(createResponse.status).toBe(201);
    expect(createResponse.body.item).toMatchObject({
      id: "service-created",
      key: "seller-created-service"
    });
  });

  it("lists seller inbound requests through protected seller routes", async () => {
    actorResolutionServiceMock.resolveFromHeader.mockResolvedValue({
      status: "ready",
      selection: {
        profileKey: "seller-admin",
        workspace: "SELLER",
        userEmail: "seller@atlas.local",
        organizationSlug: "atlas-demo-seller",
        role: "ADMIN",
        agentId: null
      },
      actor: createActor("SELLER", "ADMIN")
    });

    const response = await request(app.getHttpServer())
      .get("/sellers/requests")
      .set("x-atlas-local-session", "local-token");

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([
      expect.objectContaining({
        id: "seller-request-1",
        matchedServiceName: "Global Dataset Access"
      })
    ]);
  });

  it("serves seller analytics and fulfillment actions through protected seller routes", async () => {
    actorResolutionServiceMock.resolveFromHeader.mockResolvedValue({
      status: "ready",
      selection: {
        profileKey: "seller-admin",
        workspace: "SELLER",
        userEmail: "seller@atlas.local",
        organizationSlug: "atlas-demo-seller",
        role: "ADMIN",
        agentId: null
      },
      actor: createActor("SELLER", "ADMIN")
    });

    const analyticsResponse = await request(app.getHttpServer())
      .get("/sellers/analytics")
      .set("x-atlas-local-session", "local-token");
    const fulfillmentResponse = await request(app.getHttpServer())
      .post("/sellers/requests/seller-request-1/fulfillment")
      .set("x-atlas-local-session", "local-token")
      .send({
        fulfillmentStatus: "DELIVERED",
        note: "The seller delivered the dataset unlock and recorded the outcome."
      });

    expect(analyticsResponse.status).toBe(200);
    expect(analyticsResponse.body.item).toMatchObject({
      pendingFulfillmentCount: 2,
      topServices: [
        expect.objectContaining({
          serviceKey: "global-dataset-access"
        })
      ]
    });
    expect(fulfillmentResponse.status).toBe(201);
    expect(fulfillmentResponse.body.item).toMatchObject({
      id: "seller-request-1",
      status: "COMPLETED",
      fulfillment: expect.objectContaining({
        fulfillmentStatus: "DELIVERED"
      })
    });
  });

  it("enforces operator role boundaries on actor routes", async () => {
    actorResolutionServiceMock.resolveFromHeader.mockResolvedValue({
      status: "ready",
      selection: {
        profileKey: "buyer-finance",
        workspace: "BUYER",
        userEmail: "finance@atlas.local",
        organizationSlug: "atlas-demo-buyer",
        role: "FINANCE",
        agentId: null
      },
      actor: createActor("BUYER", "FINANCE")
    });

    const response = await request(app.getHttpServer())
      .get("/actor/operator")
      .set("x-atlas-local-session", "local-token");

    expect(response.status).toBe(403);
  });
});
