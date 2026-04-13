import type { AtlasActorContext } from "@atlas/auth";
import type { Prisma } from "@atlas/database";

export function createRequestDetailWhere(
  actor: AtlasActorContext,
  recordId: string
): Prisma.SpendRequestWhereInput {
  if (actor.workspace === "BUYER") {
    return {
      id: recordId,
      organizationId: actor.organization.id
    };
  }

  if (actor.workspace === "SELLER") {
    return {
      id: recordId,
      sellerOrganizationId: actor.organization.id
    };
  }

  return {
    id: recordId
  };
}

export function createApprovalDetailWhere(
  actor: AtlasActorContext,
  recordId: string
): Prisma.ApprovalWhereInput {
  const scopedRequestWhere =
    actor.workspace === "BUYER"
      ? {
          organizationId: actor.organization.id
        }
      : actor.workspace === "SELLER"
        ? {
            sellerOrganizationId: actor.organization.id
          }
        : {};

  return {
    OR: [
      {
        id: recordId
      },
      {
        requestId: recordId
      }
    ],
    request: scopedRequestWhere
  };
}

export function createPaymentDetailWhere(
  actor: AtlasActorContext,
  recordId: string
): Prisma.PaymentWhereInput {
  if (actor.workspace === "BUYER") {
    return {
      OR: [
        {
          id: recordId
        },
        {
          requestId: recordId
        }
      ],
      organizationId: actor.organization.id
    };
  }

  if (actor.workspace === "SELLER") {
    return {
      OR: [
        {
          id: recordId
        },
        {
          requestId: recordId
        }
      ],
      sellerOrganizationId: actor.organization.id
    };
  }

  return {
    OR: [
      {
        id: recordId
      },
      {
        requestId: recordId
      }
    ]
  };
}

export function createReceiptDetailWhere(
  actor: AtlasActorContext,
  recordId: string
): Prisma.ReceiptWhereInput {
  if (actor.workspace === "BUYER") {
    return {
      OR: [
        {
          id: recordId
        },
        {
          requestId: recordId
        }
      ],
      organizationId: actor.organization.id
    };
  }

  if (actor.workspace === "SELLER") {
    return {
      OR: [
        {
          id: recordId
        },
        {
          requestId: recordId
        }
      ],
      request: {
        is: {
          sellerOrganizationId: actor.organization.id
        }
      }
    };
  }

  return {
    OR: [
      {
        id: recordId
      },
      {
        requestId: recordId
      }
    ]
  };
}

export function createAuditDetailWhere(
  actor: AtlasActorContext,
  recordId: string
): Prisma.AuditEventWhereInput {
  if (actor.workspace === "BUYER") {
    return {
      id: recordId,
      OR: [
        {
          organizationId: actor.organization.id
        },
        {
          request: {
            is: {
              organizationId: actor.organization.id
            }
          }
        }
      ]
    };
  }

  if (actor.workspace === "SELLER") {
    return {
      id: recordId,
      request: {
        is: {
          sellerOrganizationId: actor.organization.id
        }
      }
    };
  }

  return {
    id: recordId
  };
}
