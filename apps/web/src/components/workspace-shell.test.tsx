import type { ReactNode } from "react";
import type { AtlasActorContext, AtlasLocalSessionProfile } from "@atlas/auth";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkspaceShell } from "./workspace-shell";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/buyer/agents"
}));

const actor: AtlasActorContext = {
  user: {
    id: "user-buyer",
    email: "owner@atlas.local",
    name: "Buyer Owner"
  },
  organization: {
    id: "org-buyer",
    slug: "atlas-demo-buyer",
    name: "Atlas Demo Buyer",
    kind: "BUYER"
  },
  membership: {
    id: "membership-buyer",
    role: "OWNER"
  },
  workspace: "BUYER",
  agentId: null,
  source: "local-development",
  providerMode: "local-signed",
  sessionId: null,
  principalOrganization: null,
  supportAccess: null
};

const profiles: AtlasLocalSessionProfile[] = [
  {
    key: "buyer-owner",
    label: "Buyer Owner",
    workspace: "BUYER",
    userEmail: "owner@atlas.local",
    organizationSlug: "atlas-demo-buyer",
    role: "OWNER"
  },
  {
    key: "buyer-finance",
    label: "Buyer Finance",
    workspace: "BUYER",
    userEmail: "finance@atlas.local",
    organizationSlug: "atlas-demo-buyer",
    role: "FINANCE"
  }
];

describe("WorkspaceShell", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders context, navigation, and session switching controls", () => {
    const { container } = render(
      <WorkspaceShell
        actor={actor}
        title="Buyer workspace"
        subtitle="Controlled autonomy"
        description="Buyer shell"
        path="/buyer"
        items={[
          {
            href: "/buyer",
            label: "Overview",
            description: "Buyer overview"
          },
          {
            href: "/buyer/agents",
            label: "Agents",
            description: "Agent inventory"
          }
        ]}
        profiles={profiles}
      >
        <div>Route content</div>
      </WorkspaceShell>
    );

    expect(screen.getAllByText("Buyer workspace")).toHaveLength(2);
    expect(screen.getAllByText("Atlas Demo Buyer")).toHaveLength(2);
    expect(screen.getByText("Route content")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Buyer Owner" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Buyer Finance" })).toBeTruthy();
    expect(screen.getByText("Workspace")).toBeTruthy();
    expect(container.innerHTML).toContain("/buyer/agents");
    expect(container.innerHTML).toContain("border-[var(--atlas-accent)] bg-white/10");
  });
});
