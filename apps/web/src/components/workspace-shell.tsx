"use client";

import {
  formatAtlasRoleLabel,
  formatAtlasWorkspaceLabel,
  type AtlasActorContext,
  type AtlasLocalSessionProfile
} from "@atlas/auth";
import {
  AppFrame,
  ContextDisplay,
  PageHeader,
  Panel,
  SidebarNav,
  StatePanel,
  TopBar,
  type SidebarNavItem
} from "@atlas/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type WorkspaceShellProps = Readonly<{
  actor: AtlasActorContext;
  title: string;
  subtitle: string;
  description: string;
  path: string;
  items: SidebarNavItem[];
  profiles: AtlasLocalSessionProfile[];
  children: ReactNode;
}>;

type WorkspaceDeniedStateProps = Readonly<{
  workspaceLabel: string;
  path: string;
  profiles: AtlasLocalSessionProfile[];
  title: string;
  description: string;
}>;

function SessionSwitchForm({
  profile,
  path,
  current
}: Readonly<{
  profile: AtlasLocalSessionProfile;
  path: string;
  current: boolean;
}>) {
  return (
    <form action="/auth/session" method="post">
      <input type="hidden" name="profileKey" value={profile.key} />
      <input type="hidden" name="redirectTo" value={path} />
      <button
        type="submit"
        className={[
          "rounded-full border px-3 py-2 text-xs font-medium uppercase tracking-[0.16em] transition",
          current
            ? "border-[var(--atlas-accent)] bg-white/10 text-[var(--atlas-ink)]"
            : "border-[var(--atlas-line)] bg-white/4 text-[var(--atlas-muted)] hover:border-[var(--atlas-accent)] hover:text-[var(--atlas-ink)]"
        ].join(" ")}
      >
        {profile.label}
      </button>
    </form>
  );
}

function ExitSupportModeForm() {
  return (
    <form action="/auth/session" method="post">
      <input type="hidden" name="intent" value="clear" />
      <input type="hidden" name="redirectTo" value="/operator/support-access" />
      <button
        type="submit"
        className="rounded-full border border-[var(--atlas-line)] bg-white/4 px-3 py-2 text-xs font-medium uppercase tracking-[0.16em] text-[var(--atlas-muted)] transition hover:border-[var(--atlas-accent)] hover:text-[var(--atlas-ink)]"
      >
        Exit support mode
      </button>
    </form>
  );
}

export function WorkspaceShell({
  actor,
  title,
  subtitle,
  description,
  path,
  items,
  profiles,
  children
}: WorkspaceShellProps) {
  const pathname = usePathname();
  const currentProfile = profiles.find(
    (profile) =>
      profile.userEmail === actor.user.email &&
      profile.organizationSlug === actor.organization.slug &&
      profile.role === actor.membership.role
  );
  const resolvedItems = items.map((item) => ({
    ...item,
    current: pathname === item.href
  }));

  return (
    <AppFrame
      sidebar={
        <SidebarNav
          title={title}
          subtitle={subtitle}
          items={resolvedItems}
          footer={
            <Panel className="space-y-3 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--atlas-muted)]">
                Active context
              </p>
              <ContextDisplay label="Workspace" value={formatAtlasWorkspaceLabel(actor.workspace)} />
              <ContextDisplay label="Organization" value={actor.organization.name} />
              <ContextDisplay
                label="Session"
                value={`${actor.user.name ?? actor.user.email} / ${formatAtlasRoleLabel(actor.membership.role)}`}
              />
              <ContextDisplay
                label="Source"
                value={
                  actor.source === "internal-support"
                    ? "Internal support"
                    : actor.source === "identity-provider"
                      ? actor.providerMode === "external-oidc"
                        ? "External OIDC"
                        : "Identity provider"
                      : actor.source === "identity-bridge"
                        ? "Identity bridge"
                        : "Signed local session"
                }
              />
              {actor.supportAccess ? (
                <ContextDisplay label="Support scope" value={`${actor.supportAccess.targetOrganizationSlug} / ${actor.supportAccess.reason}`} />
              ) : null}
            </Panel>
          }
        />
      }
      topBar={
        <TopBar title={actor.organization.name} subtitle={`${actor.user.name ?? actor.user.email} · ${formatAtlasRoleLabel(actor.membership.role)}`}>
          {actor.source === "internal-support" ? <ExitSupportModeForm /> : null}
          {profiles.map((profile) => (
            <SessionSwitchForm
              key={profile.key}
              profile={profile}
              path={path}
              current={profile.key === currentProfile?.key}
            />
          ))}
        </TopBar>
      }
    >
      <div className="space-y-6">
        <PageHeader eyebrow={subtitle} title={title} description={description} />
        {children}
      </div>
    </AppFrame>
  );
}

export function WorkspaceDeniedState({
  workspaceLabel,
  path,
  profiles,
  title,
  description
}: WorkspaceDeniedStateProps) {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl items-center px-4 py-8 sm:px-6">
      <StatePanel
        eyebrow={`${workspaceLabel} access`}
        title={title}
        description={description}
        tone="warning"
        actions={
          <>
            {profiles.map((profile) => (
              <SessionSwitchForm key={profile.key} profile={profile} path={path} current={false} />
            ))}
            <Link
              href="/"
              className="rounded-full border border-[var(--atlas-line)] bg-white/4 px-4 py-2 text-xs font-medium uppercase tracking-[0.16em] text-[var(--atlas-muted)] transition hover:border-[var(--atlas-accent)] hover:text-[var(--atlas-ink)]"
            >
              Return to Atlas
            </Link>
          </>
        }
      />
    </main>
  );
}
