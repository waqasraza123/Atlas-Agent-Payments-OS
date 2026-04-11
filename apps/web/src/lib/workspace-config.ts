import {
  getAtlasWorkspaceDefinition,
  getAtlasWorkspaceSurfaceByHref,
  listAtlasWorkspaceSurfaces,
  type AtlasWorkspaceDefinition
} from "@atlas/domain";
import type { OrganizationKind } from "@atlas/types";
import type { SidebarNavItem } from "@atlas/ui";

export type AtlasWorkspaceShellDefinition = AtlasWorkspaceDefinition & {
  sections: SidebarNavItem[];
  path: string;
};

export function getAtlasWorkspaceShellDefinition(
  workspace: OrganizationKind,
  currentPath: string
): AtlasWorkspaceShellDefinition {
  const definition = getAtlasWorkspaceDefinition(workspace);
  const sections = listAtlasWorkspaceSurfaces(workspace).map((surface) => ({
    href: surface.href,
    label: surface.label,
    description: surface.detail,
    current:
      surface.href === currentPath ||
      (currentPath === definition.rootHref && surface.href === definition.rootHref) ||
      getAtlasWorkspaceSurfaceByHref(workspace, currentPath)?.href === surface.href
  }));

  return {
    ...definition,
    path: definition.rootHref,
    sections
  };
}
