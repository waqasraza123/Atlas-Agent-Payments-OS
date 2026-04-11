import type { MembershipRole } from "@atlas/types";

export type SessionActor = {
  userId: string;
  organizationId: string;
  roles: MembershipRole[];
};

export function hasRole(actor: SessionActor, role: MembershipRole) {
  return actor.roles.includes(role);
}
