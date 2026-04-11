import { z } from "zod";
import {
  servicePricingModels,
  serviceStatuses,
  serviceVisibilityModes,
  type ServicePricingModel,
  type ServiceStatus,
  type ServiceVisibilityMode,
  type SpendRequestStatus
} from "@atlas/types";

const trimmedString = z.string().trim().min(1);

export const atlasSellerServiceCreateSchema = z.object({
  key: z
    .string()
    .trim()
    .min(3)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "Service key must use lowercase letters, numbers, and hyphens."),
  name: trimmedString.min(3).max(120),
  description: z.string().trim().min(20).max(600),
  category: trimmedString.min(2).max(80),
  status: z.enum(serviceStatuses).default("DRAFT"),
  visibility: z.enum(serviceVisibilityModes).default("PRIVATE"),
  pricingModel: z.enum(servicePricingModels).default("FIXED"),
  priceMinor: z.number().int().positive().max(10_000_000),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase())
});

export const atlasSellerServiceUpdateSchema = z.object({
  key: z
    .string()
    .trim()
    .min(3)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "Service key must use lowercase letters, numbers, and hyphens.")
    .optional(),
  name: z.string().trim().min(3).max(120).optional(),
  description: z.string().trim().min(20).max(600).optional(),
  category: z.string().trim().min(2).max(80).optional(),
  status: z.enum(serviceStatuses).optional(),
  visibility: z.enum(serviceVisibilityModes).optional(),
  pricingModel: z.enum(servicePricingModels).optional(),
  priceMinor: z.number().int().positive().max(10_000_000).optional(),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).optional()
});

export type AtlasSellerServiceCreateInput = z.infer<typeof atlasSellerServiceCreateSchema>;
export type AtlasSellerServiceUpdateInput = z.infer<typeof atlasSellerServiceUpdateSchema>;

export type AtlasSellerServiceRecord = {
  id: string;
  organizationId: string;
  key: string;
  name: string;
  description: string;
  category: string;
  status: ServiceStatus;
  visibility: ServiceVisibilityMode;
  pricingModel: ServicePricingModel;
  priceMinor: number;
  currency: string;
  linkedRequestCount: number;
};

export type AtlasSellerProfileRecord = {
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
  serviceCount: number;
  publishedServiceCount: number;
  requestCount: number;
  activeBuyerCount: number;
};

export type AtlasSellerTeamMemberRecord = {
  membershipId: string;
  userId: string;
  userEmail: string;
  userName: string | null;
  role: string;
};

export type AtlasSellerRequestRecord = {
  id: string;
  buyerOrganizationId: string;
  buyerOrganizationName: string;
  title: string;
  purpose: string;
  amountMinor: number;
  currency: string;
  serviceCategory: string;
  serviceKey: string | null;
  matchedServiceId: string | null;
  matchedServiceName: string | null;
  status: SpendRequestStatus;
  createdAt: string;
};

export function formatAtlasServiceStatusLabel(status: ServiceStatus) {
  return status.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\w/g, (character) => character.toUpperCase());
}

export function formatAtlasServiceVisibilityLabel(visibility: ServiceVisibilityMode) {
  return visibility.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\w/g, (character) => character.toUpperCase());
}

export function formatAtlasServicePricingModelLabel(pricingModel: ServicePricingModel) {
  return pricingModel.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\w/g, (character) => character.toUpperCase());
}
