import {
  AtlasAnalyticsReportingError,
  AtlasBuyerWorkflowError,
  AtlasExternalIdentityAccessWorkflowError,
  AtlasOperationalIntegrationWorkflowError,
  AtlasOperatorWorkflowError,
  AtlasPaymentsWorkflowError,
  AtlasProgrammableSettlementError,
  AtlasRolloutAutomationError,
  AtlasSellerWorkflowError
} from "@atlas/database";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException
} from "@nestjs/common";

export function rethrowBuyerWorkflowError(error: unknown): never {
  if (!(error instanceof AtlasBuyerWorkflowError)) {
    throw error;
  }

  rethrowAtlasWorkflowError(error);
}

export function rethrowAnalyticsReportingError(error: unknown): never {
  if (!(error instanceof AtlasAnalyticsReportingError)) {
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

export function rethrowPaymentsWorkflowError(error: unknown): never {
  if (!(error instanceof AtlasPaymentsWorkflowError)) {
    throw error;
  }

  rethrowAtlasWorkflowError(error);
}

export function rethrowProgrammableSettlementError(error: unknown): never {
  if (!(error instanceof AtlasProgrammableSettlementError)) {
    throw error;
  }

  rethrowAtlasWorkflowError(error);
}

export function rethrowOperatorWorkflowError(error: unknown): never {
  if (!(error instanceof AtlasOperatorWorkflowError)) {
    throw error;
  }

  rethrowAtlasWorkflowError(error);
}

export function rethrowExternalIdentityAccessWorkflowError(error: unknown): never {
  if (!(error instanceof AtlasExternalIdentityAccessWorkflowError)) {
    throw error;
  }

  rethrowAtlasWorkflowError(error);
}

export function rethrowRolloutAutomationError(error: unknown): never {
  if (!(error instanceof AtlasRolloutAutomationError)) {
    throw error;
  }

  if (error.code === "execution_failed") {
    throw new InternalServerErrorException(error.message);
  }

  rethrowAtlasWorkflowError(error);
}

export function rethrowOperationalIntegrationWorkflowError(error: unknown): never {
  if (!(error instanceof AtlasOperationalIntegrationWorkflowError)) {
    throw error;
  }

  rethrowAtlasWorkflowError(error);
}

function rethrowAtlasWorkflowError(
  error:
    | AtlasAnalyticsReportingError
    | AtlasBuyerWorkflowError
    | AtlasExternalIdentityAccessWorkflowError
    | AtlasSellerWorkflowError
    | AtlasPaymentsWorkflowError
    | AtlasProgrammableSettlementError
    | AtlasOperationalIntegrationWorkflowError
    | AtlasOperatorWorkflowError
    | AtlasExternalIdentityAccessWorkflowError
    | AtlasRolloutAutomationError
): never {
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
