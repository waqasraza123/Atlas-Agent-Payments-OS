import {
  isAtlasIdentityProviderActor,
  isAtlasLocalDevelopmentActor,
  type AtlasActorContext
} from "@atlas/auth";
import {
  appRuntime,
  requiresAtlasExternalOidcForReleaseStage,
  requiresAtlasProviderBackedAuthForEnvironment,
  requiresAtlasProviderBackedOperatorGovernanceForStage
} from "@atlas/config";

type AtlasGovernanceErrorFactory<T extends Error> = (message: string) => T;

export function assertAtlasOperatorSessionGovernance<T extends Error>(
  actor: AtlasActorContext,
  input: {
    surface: string;
    createError: AtlasGovernanceErrorFactory<T>;
  }
) {
  if (requiresAtlasProviderBackedAuthForEnvironment(appRuntime.appEnv) && isAtlasLocalDevelopmentActor(actor)) {
    throw input.createError(`${input.surface} require a provider-backed Atlas session outside local and development.`);
  }

  if (
    requiresAtlasProviderBackedOperatorGovernanceForStage(appRuntime.releaseStage) &&
    !isAtlasIdentityProviderActor(actor)
  ) {
    throw input.createError(
      `${input.surface} require provider-backed Atlas sessions during ${appRuntime.releaseStage} release operations.`
    );
  }

  if (requiresAtlasExternalOidcForReleaseStage(appRuntime.releaseStage) && actor.providerMode !== "external-oidc") {
    throw input.createError(
      `${input.surface} require external OIDC Atlas sessions during ${appRuntime.releaseStage} release operations.`
    );
  }
}

export function assertAtlasSupportGrantProviderMode<T extends Error>(
  authProviderMode: string,
  input: {
    surface: string;
    createError: AtlasGovernanceErrorFactory<T>;
  }
) {
  if (requiresAtlasProviderBackedAuthForEnvironment(appRuntime.appEnv) && authProviderMode === "LOCAL_SIGNED") {
    throw input.createError(`${input.surface} require provider-backed support grants outside local and development.`);
  }

  if (requiresAtlasExternalOidcForReleaseStage(appRuntime.releaseStage) && authProviderMode !== "EXTERNAL_OIDC") {
    throw input.createError(
      `${input.surface} require externally brokered support grants during ${appRuntime.releaseStage} release operations.`
    );
  }
}
