import { canAtlasActorMutate, type AtlasActorContext } from "@atlas/auth";
import { programmableSettlementRuntime } from "@atlas/config";
import {
  atlasProgrammableSettlementSettingsSchema,
  atlasProgrammableWalletCreateSchema,
  atlasProgrammableWalletVerificationSchema,
  createAtlasProgrammableSettlementSettings,
  deriveAtlasProgrammableSettlementReadiness,
  formatAtlasProgrammableChainLabel,
  normalizeAtlasWalletAddress,
  type AtlasOrganizationProgrammableSettlementRecord,
  type AtlasOrganizationWalletRecord,
  type AtlasProgrammableChainRecord
} from "@atlas/domain";
import { ZodError } from "zod";
import { isProgrammableSettlementChain, type PaymentRail, type ProgrammableSettlementChain } from "@atlas/types";
import { Prisma, type PrismaClient } from "./generated/client/index.js";
import { prisma } from "./client";

export class AtlasProgrammableSettlementError extends Error {
  constructor(
    message: string,
    readonly code: "bad_request" | "not_found" | "conflict" | "forbidden"
  ) {
    super(message);
    this.name = "AtlasProgrammableSettlementError";
  }
}

function assertProgrammableSettlementActor(actor: AtlasActorContext) {
  if (!canAtlasActorMutate(actor)) {
    throw new AtlasProgrammableSettlementError(
      "Support-access sessions are limited to read-only programmable-settlement routes.",
      "forbidden"
    );
  }
}

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

function asJsonObject(value: Prisma.JsonValue | null): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function asInputJsonValue(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function normalizeProgrammableSettlementError(error: unknown): never {
  if (error instanceof AtlasProgrammableSettlementError) {
    throw error;
  }

  if (error instanceof ZodError) {
    throw new AtlasProgrammableSettlementError(error.issues.map((issue) => issue.message).join("; "), "bad_request");
  }

  throw error;
}

export function getAtlasSupportedProgrammableSettlementChain(): AtlasProgrammableChainRecord {
  const chainKey = isProgrammableSettlementChain(programmableSettlementRuntime.chainKey)
    ? programmableSettlementRuntime.chainKey
    : "BASE_SEPOLIA";

  return {
    key: chainKey,
    chainId: programmableSettlementRuntime.chainId,
    label: formatAtlasProgrammableChainLabel(chainKey),
    networkName: programmableSettlementRuntime.networkName,
    assetSymbol: programmableSettlementRuntime.assetSymbol,
    explorerBaseUrl: programmableSettlementRuntime.explorerBaseUrl,
    requiredConfirmations: programmableSettlementRuntime.requiredConfirmations,
    enabled: programmableSettlementRuntime.enabled
  };
}

export function getAtlasOrganizationProgrammableSettlementSettingsFromMetadata(metadata: Prisma.JsonValue | null) {
  const metadataObject = asJsonObject(metadata);
  const programmableSettlement =
    metadataObject?.programmableSettlement &&
    typeof metadataObject.programmableSettlement === "object" &&
    !Array.isArray(metadataObject.programmableSettlement)
      ? (metadataObject.programmableSettlement as Record<string, unknown>)
      : null;

  const parsed = atlasProgrammableSettlementSettingsSchema.safeParse({
    allowedRails: Array.isArray(programmableSettlement?.allowedRails)
      ? programmableSettlement.allowedRails
      : ["INTERNAL_SIMULATED", "STRIPE"],
    preferredRail: typeof programmableSettlement?.preferredRail === "string" ? programmableSettlement.preferredRail : null
  });

  return parsed.success
    ? parsed.data
    : createAtlasProgrammableSettlementSettings({
        allowedRails: ["INTERNAL_SIMULATED", "STRIPE"],
        preferredRail: null
      });
}

function buildOrganizationMetadata(
  metadata: Prisma.JsonValue | null,
  allowedRails: PaymentRail[],
  preferredRail: PaymentRail | null
) {
  const metadataObject = asJsonObject(metadata) ?? {};

  return asInputJsonValue({
    ...metadataObject,
    programmableSettlement: {
      allowedRails,
      preferredRail
    }
  });
}

function mapOrganizationWalletRecord(wallet: {
  id: string;
  organizationId: string;
  chain: string;
  address: string;
  label: string;
  ownershipLabel: string;
  verificationStatus: string;
  verificationNote: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
  organization: {
    id: string;
    name: string;
    kind: string;
  };
}): AtlasOrganizationWalletRecord {
  return {
    id: wallet.id,
    organizationId: wallet.organization.id,
    organizationName: wallet.organization.name,
    organizationKind: wallet.organization.kind,
    label: wallet.label,
    address: wallet.address,
    chain: wallet.chain as AtlasOrganizationWalletRecord["chain"],
    chainLabel: formatAtlasProgrammableChainLabel(wallet.chain as AtlasOrganizationWalletRecord["chain"]),
    verificationStatus: wallet.verificationStatus as AtlasOrganizationWalletRecord["verificationStatus"],
    ownershipLabel: wallet.ownershipLabel,
    isDefault: wallet.isDefault,
    verificationNote: wallet.verificationNote,
    createdAt: wallet.createdAt.toISOString(),
    updatedAt: wallet.updatedAt.toISOString()
  };
}

async function requireProgrammableSettlementOrganization(
  actor: AtlasActorContext,
  client: DatabaseClient
) {
  if (!["BUYER", "SELLER"].includes(actor.workspace)) {
    throw new AtlasProgrammableSettlementError(
      "Programmable settlement organization management is only available in buyer and seller workspaces.",
      "forbidden"
    );
  }

  const organization = await client.organization.findUnique({
    where: {
      id: actor.organization.id
    },
    include: {
      wallets: {
        orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }]
      }
    }
  });

  if (!organization) {
    throw new AtlasProgrammableSettlementError("The current organization could not be resolved.", "not_found");
  }

  return organization;
}

export async function getDefaultVerifiedOrganizationWallet(
  organizationId: string,
  client: DatabaseClient = prisma
) {
  const wallet = await client.organizationWallet.findFirst({
    where: {
      organizationId,
      verificationStatus: "VERIFIED"
    },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    include: {
      organization: true
    }
  });

  return wallet ? mapOrganizationWalletRecord(wallet) : null;
}

export async function listOrganizationWallets(actor: AtlasActorContext, client: DatabaseClient = prisma) {
  try {
    const organization = await requireProgrammableSettlementOrganization(actor, client);

    return organization.wallets
      .map((wallet) =>
        mapOrganizationWalletRecord({
          ...wallet,
          organization: {
            id: organization.id,
            name: organization.name,
            kind: organization.kind
          }
        })
      )
      .sort((left, right) => Number(right.isDefault) - Number(left.isDefault) || left.label.localeCompare(right.label));
  } catch (error) {
    normalizeProgrammableSettlementError(error);
  }
}

export async function getOrganizationProgrammableSettlement(actor: AtlasActorContext, client: DatabaseClient = prisma) {
  try {
    const organization = await requireProgrammableSettlementOrganization(actor, client);
    const settings = getAtlasOrganizationProgrammableSettlementSettingsFromMetadata(organization.metadata);
    const wallets = organization.wallets.map((wallet) =>
      mapOrganizationWalletRecord({
        ...wallet,
        organization: {
          id: organization.id,
          name: organization.name,
          kind: organization.kind
        }
      })
    );
    const defaultVerifiedWallet = wallets.find((wallet) => wallet.isDefault && wallet.verificationStatus === "VERIFIED") ?? null;

    return {
      organizationId: organization.id,
      organizationName: organization.name,
      organizationSlug: organization.slug,
      organizationKind: organization.kind,
      settings,
      supportedChain: getAtlasSupportedProgrammableSettlementChain(),
      wallets,
      readiness: deriveAtlasProgrammableSettlementReadiness({
        runtimeEnabled: programmableSettlementRuntime.enabled,
        programmableRailAllowed: settings.allowedRails.includes("PROGRAMMABLE_USDC"),
        defaultVerifiedWallet,
        counterpartyVerifiedWallet: defaultVerifiedWallet,
        requireCounterpartyWallet: false
      })
    } satisfies AtlasOrganizationProgrammableSettlementRecord;
  } catch (error) {
    normalizeProgrammableSettlementError(error);
  }
}

export async function createOrganizationWallet(actor: AtlasActorContext, input: unknown) {
  try {
    assertProgrammableSettlementActor(actor);
    const parsed = atlasProgrammableWalletCreateSchema.parse(input);
    const normalizedAddress = normalizeAtlasWalletAddress(parsed.address);

    return await prisma.$transaction(async (transaction) => {
      const organization = await requireProgrammableSettlementOrganization(actor, transaction);

      if (parsed.isDefault) {
        await transaction.organizationWallet.updateMany({
          where: {
            organizationId: organization.id,
            chain: parsed.chain
          },
          data: {
            isDefault: false
          }
        });
      }

      const wallet = await transaction.organizationWallet.upsert({
        where: {
          organizationId_chain_address: {
            organizationId: organization.id,
            chain: parsed.chain,
            address: normalizedAddress
          }
        },
        update: {
          label: parsed.label,
          ownershipLabel: parsed.ownershipLabel,
          isDefault: parsed.isDefault,
          verificationStatus: "PENDING",
          verificationNote: null,
          metadata: asInputJsonValue({
            updatedByUserId: actor.user.id
          })
        },
        create: {
          organizationId: organization.id,
          chain: parsed.chain,
          address: normalizedAddress,
          label: parsed.label,
          ownershipLabel: parsed.ownershipLabel,
          isDefault: parsed.isDefault,
          verificationStatus: "PENDING",
          metadata: asInputJsonValue({
            createdByUserId: actor.user.id
          })
        },
        include: {
          organization: true
        }
      });

      return mapOrganizationWalletRecord(wallet);
    });
  } catch (error) {
    normalizeProgrammableSettlementError(error);
  }
}

export async function updateOrganizationProgrammableSettlementSettings(
  actor: AtlasActorContext,
  input: unknown,
  client: DatabaseClient = prisma
) {
  try {
    assertProgrammableSettlementActor(actor);
    const parsed = atlasProgrammableSettlementSettingsSchema.parse(input);

    const organization = await requireProgrammableSettlementOrganization(actor, client);
    const updated = await client.organization.update({
      where: {
        id: organization.id
      },
      data: {
        metadata: buildOrganizationMetadata(organization.metadata, parsed.allowedRails, parsed.preferredRail)
      },
      include: {
        wallets: {
          orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }]
        }
      }
    });

    return {
      organizationId: updated.id,
      organizationName: updated.name,
      organizationSlug: updated.slug,
      organizationKind: updated.kind,
      settings: parsed,
      supportedChain: getAtlasSupportedProgrammableSettlementChain(),
      wallets: updated.wallets.map((wallet) =>
        mapOrganizationWalletRecord({
          ...wallet,
          organization: {
            id: updated.id,
            name: updated.name,
            kind: updated.kind
          }
        })
      ),
      readiness: deriveAtlasProgrammableSettlementReadiness({
        runtimeEnabled: programmableSettlementRuntime.enabled,
        programmableRailAllowed: parsed.allowedRails.includes("PROGRAMMABLE_USDC"),
        defaultVerifiedWallet:
          updated.wallets
            .map((wallet) =>
              mapOrganizationWalletRecord({
                ...wallet,
                organization: {
                  id: updated.id,
                  name: updated.name,
                  kind: updated.kind
                }
              })
            )
            .find((wallet) => wallet.isDefault && wallet.verificationStatus === "VERIFIED") ?? null,
        counterpartyVerifiedWallet: null,
        requireCounterpartyWallet: false
      })
    } satisfies AtlasOrganizationProgrammableSettlementRecord;
  } catch (error) {
    normalizeProgrammableSettlementError(error);
  }
}

export async function verifyOrganizationWallet(
  actor: AtlasActorContext,
  walletId: string,
  input: unknown,
  client: DatabaseClient = prisma
) {
  try {
    if (actor.workspace !== "OPERATOR") {
      throw new AtlasProgrammableSettlementError("Only operator users can verify programmable-settlement wallets.", "forbidden");
    }

    const parsed = atlasProgrammableWalletVerificationSchema.parse(input);
    const wallet = await client.organizationWallet.findUnique({
      where: {
        id: walletId
      },
      include: {
        organization: true
      }
    });

    if (!wallet) {
      throw new AtlasProgrammableSettlementError("The selected programmable-settlement wallet was not found.", "not_found");
    }

    const updated = await client.organizationWallet.update({
      where: {
        id: walletId
      },
      data: {
        verificationStatus: parsed.status,
        verificationNote: parsed.note,
        metadata: asInputJsonValue({
          ...(asJsonObject(wallet.metadata) ?? {}),
          verifiedByUserId: actor.user.id,
          verifiedAt: new Date().toISOString()
        })
      },
      include: {
        organization: true
      }
    });

    return mapOrganizationWalletRecord(updated);
  } catch (error) {
    normalizeProgrammableSettlementError(error);
  }
}

export async function listProgrammableSettlementOrganizations(client: DatabaseClient = prisma) {
  const organizations = await client.organization.findMany({
    where: {
      kind: {
        in: ["BUYER", "SELLER"]
      }
    },
    include: {
      wallets: {
        orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }]
      }
    },
    orderBy: {
      name: "asc"
    }
  });

  return organizations.map((organization) => {
    const wallets = organization.wallets.map((wallet) =>
      mapOrganizationWalletRecord({
        ...wallet,
        organization: {
          id: organization.id,
          name: organization.name,
          kind: organization.kind
        }
      })
    );
    const settings = getAtlasOrganizationProgrammableSettlementSettingsFromMetadata(organization.metadata);
    const defaultVerifiedWallet = wallets.find((wallet) => wallet.isDefault && wallet.verificationStatus === "VERIFIED") ?? null;

    return {
      organizationId: organization.id,
      organizationName: organization.name,
      organizationSlug: organization.slug,
      organizationKind: organization.kind,
      settings,
      supportedChain: getAtlasSupportedProgrammableSettlementChain(),
      wallets,
      readiness: deriveAtlasProgrammableSettlementReadiness({
        runtimeEnabled: programmableSettlementRuntime.enabled,
        programmableRailAllowed: settings.allowedRails.includes("PROGRAMMABLE_USDC"),
        defaultVerifiedWallet,
        counterpartyVerifiedWallet: null,
        requireCounterpartyWallet: false
      })
    } satisfies AtlasOrganizationProgrammableSettlementRecord;
  });
}
