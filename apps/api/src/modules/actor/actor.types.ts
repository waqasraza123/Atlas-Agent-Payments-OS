import type { AtlasActorContext } from "@atlas/auth";

export type ActorRequest = {
  headers: Record<string, string | string[] | undefined>;
  atlasActor?: AtlasActorContext;
};
