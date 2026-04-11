import { AtlasBuyerWorkflowError, AtlasSellerWorkflowError } from "@atlas/database";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException
} from "@nestjs/common";

export function rethrowBuyerWorkflowError(error: unknown): never {
  if (!(error instanceof AtlasBuyerWorkflowError)) {
    throw error;
  }

  rethrowAtlasWorkflowError(error);
}

export function rethrowSellerWorkflowError(error: unknown): never {
  if (!(error instanceof AtlasSellerWorkflowError)) {
    throw error;
  }

  rethrowAtlasWorkflowError(error);
}

function rethrowAtlasWorkflowError(error: AtlasBuyerWorkflowError | AtlasSellerWorkflowError): never {
  if (error.code === "bad_request") {
    throw new BadRequestException(error.message);
  }

  if (error.code === "conflict") {
    throw new ConflictException(error.message);
  }

  if (error.code === "forbidden") {
    throw new ForbiddenException(error.message);
  }

  throw new NotFoundException(error.message);
}
