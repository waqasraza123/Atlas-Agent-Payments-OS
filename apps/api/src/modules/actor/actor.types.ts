import type { AtlasActorContext, AtlasLocalSessionSelection } from "@atlas/auth";

export type ActorRequest = {
  headers: Record<string, string | string[] | undefined>;
  atlasActor?: AtlasActorContext;
};

export type ActorResolutionResult =
  | {
      status: "ready";
      actor: AtlasActorContext;
      selection: AtlasLocalSessionSelection;
    }
  | {
      status: "invalid";
      message: string;
    }
  | {
      status: "missing";
      message: string;
    }
  | {
      status: "unavailable";
      message: string;
    };
