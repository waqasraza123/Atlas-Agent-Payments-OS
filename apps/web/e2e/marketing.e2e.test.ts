import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const requestedPort = 3401 + Math.floor(Math.random() * 200);
const webAppRoot = fileURLToPath(new URL("..", import.meta.url));
const envFilePath = resolve(webAppRoot, "../../.env");

async function waitForHttp(url: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return true;
      }
    } catch {}

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return false;
}

function buildWebApp() {
  const result = spawnSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["exec", "dotenv", "-e", envFilePath, "--", "env", "NODE_ENV=production", "next", "build"],
    {
      cwd: webAppRoot,
      encoding: "utf8"
    }
  );

  if (result.status === 0) {
    return;
  }

  throw new Error(`Could not build the web app for e2e.\n${result.stdout}\n${result.stderr}`);
}

describe("marketing e2e", () => {
  let serverProcess: ChildProcessWithoutNullStreams | null = null;
  let serverLogs = "";
  let activeWebUrl = `http://127.0.0.1:${requestedPort}`;

  beforeAll(async () => {
    buildWebApp();

    serverProcess = spawn(
      process.platform === "win32" ? "pnpm.cmd" : "pnpm",
      [
        "exec",
        "dotenv",
        "-e",
        envFilePath,
        "--",
        "env",
        "NODE_ENV=production",
        "next",
        "start",
        "--hostname",
        "127.0.0.1",
        "--port",
        String(requestedPort)
      ],
      {
        cwd: webAppRoot,
        stdio: "pipe"
      }
    );

    serverProcess.stdout.on("data", (chunk) => {
      serverLogs += chunk.toString();
    });
    serverProcess.stderr.on("data", (chunk) => {
      serverLogs += chunk.toString();
    });

    const requestedStarted = await waitForHttp(activeWebUrl, 30000);

    if (requestedStarted) {
      return;
    }

    throw new Error(`Could not start or discover a usable web server.\n${serverLogs}`);
  }, 240000);

  afterAll(async () => {
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill("SIGTERM");
      serverProcess = null;
    }
  });

  it("serves the premium marketing narrative", async () => {
    const response = await fetch(activeWebUrl);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(html).toContain("Let agents pay for paid APIs and digital services without losing human control.");
    expect(html).toContain("The control plane for agent spending");
    expect(html).toContain("How Atlas works");
    expect(html).toContain("/buyer");
    expect(html).toContain("/seller");
    expect(html).toContain("/operator");
  });

  it("serves the buyer workspace route without crashing", async () => {
    const response = await fetch(`${activeWebUrl}/buyer`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(
      html.includes("Choose a buyer session to continue") ||
        html.includes("Buyer context could not be resolved") ||
        html.includes("Buyer workspace")
    ).toBe(true);
  });

  it("serves the buyer agents route without crashing", async () => {
    const response = await fetch(`${activeWebUrl}/buyer/agents`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(
      html.includes("Agent management baseline") ||
        html.includes("Choose a buyer session to continue") ||
        html.includes("Buyer context could not be resolved")
    ).toBe(true);
  });

  it("serves the buyer policies route without crashing", async () => {
    const response = await fetch(`${activeWebUrl}/buyer/policies`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(
      html.includes("Policy management baseline") ||
        html.includes("Choose a buyer session to continue") ||
        html.includes("Buyer context could not be resolved")
    ).toBe(true);
  });

  it("serves the buyer requests route without crashing", async () => {
    const response = await fetch(`${activeWebUrl}/buyer/requests`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(
      html.includes("Spend request creation baseline") ||
        html.includes("Choose a buyer session to continue") ||
        html.includes("Buyer context could not be resolved")
    ).toBe(true);
  });

  it("serves the buyer approvals route without crashing", async () => {
    const response = await fetch(`${activeWebUrl}/buyer/approvals`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(
      html.includes("Approval decision baseline") ||
        html.includes("Choose a buyer session to continue") ||
        html.includes("Buyer context could not be resolved")
    ).toBe(true);
  });

  it("serves the buyer activity route without crashing", async () => {
    const response = await fetch(`${activeWebUrl}/buyer/activity`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(
      html.includes("Buyer audit activity") ||
        html.includes("Choose a buyer session to continue") ||
        html.includes("Buyer context could not be resolved")
    ).toBe(true);
  });

  it("serves the buyer receipts route without crashing", async () => {
    const response = await fetch(`${activeWebUrl}/buyer/receipts`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(
      html.includes("Receipt records") ||
        html.includes("Choose a buyer session to continue") ||
        html.includes("Buyer context could not be resolved")
    ).toBe(true);
  });

  it("serves the buyer programmable settlement route without crashing", async () => {
    const response = await fetch(`${activeWebUrl}/buyer/wallets`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(
      html.includes("Buyer programmable settlement") ||
        html.includes("Choose a buyer session to continue") ||
        html.includes("Buyer context could not be resolved")
    ).toBe(true);
  });

  it("serves the buyer request csv export route without crashing", async () => {
    const response = await fetch(`${activeWebUrl}/buyer/requests/export.csv`);
    const text = await response.text();

    expect([200, 403]).toContain(response.status);
    expect(response.status === 200 ? response.headers.get("content-type")?.includes("text/csv") : text.includes("Buyer context could not be resolved")).toBe(true);
  });

  it("serves the buyer request detail route with payment execution posture", async () => {
    const response = await fetch(`${activeWebUrl}/buyer/requests/phase-0-request-approved`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(
      html.includes("Execute payment attempt") ||
        html.includes("Retry payment attempt") ||
        html.includes("Execution currently unavailable") ||
        html.includes("Choose a buyer session to continue") ||
        html.includes("Record not available in this workspace") ||
        html.includes("Buyer context could not be resolved")
    ).toBe(true);
  });

  it("serves the buyer receipt detail route without crashing", async () => {
    const response = await fetch(`${activeWebUrl}/buyer/receipts/phase-0-request-completed`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(
      html.includes("Receipt detail") ||
        html.includes("Choose a buyer session to continue") ||
        html.includes("Record not available in this workspace") ||
        html.includes("Buyer context could not be resolved")
    ).toBe(true);
  });

  it("serves the seller workspace route without crashing", async () => {
    const response = await fetch(`${activeWebUrl}/seller`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(
      html.includes("Choose a seller session to continue") ||
        html.includes("Seller context could not be resolved") ||
        html.includes("Seller workflow baseline")
    ).toBe(true);
  });

  it("serves the operator alerts route without crashing", async () => {
    const response = await fetch(`${activeWebUrl}/operator/alerts`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(
      html.includes("Alerts and incident readiness") ||
        html.includes("Operator observability could not be loaded") ||
        html.includes("Choose an operator session to continue") ||
        html.includes("Operator context could not be resolved")
    ).toBe(true);
  });

  it("serves the operator support-access route without crashing", async () => {
    const response = await fetch(`${activeWebUrl}/operator/support-access`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(
      html.includes("Scoped tenant support sessions") ||
        html.includes("Choose an operator session to continue") ||
        html.includes("Operator context could not be resolved")
    ).toBe(true);
  });

  it("serves the operator identity-access route without crashing", async () => {
    const response = await fetch(`${activeWebUrl}/operator/identity-access`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(
      html.includes("Provision external tenant identities") ||
        html.includes("Choose an operator session to continue") ||
        html.includes("Operator context could not be resolved")
    ).toBe(true);
  });

  it("serves the seller services route without crashing", async () => {
    const response = await fetch(`${activeWebUrl}/seller/services`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(
      html.includes("Service catalog and pricing baseline") ||
        html.includes("Choose a seller session to continue") ||
        html.includes("Seller context could not be resolved")
    ).toBe(true);
  });

  it("serves the seller requests route without crashing", async () => {
    const response = await fetch(`${activeWebUrl}/seller/requests`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(
      html.includes("Inbound request monitoring baseline") ||
        html.includes("Choose a seller session to continue") ||
        html.includes("Seller context could not be resolved")
    ).toBe(true);
  });

  it("serves the seller programmable settlement route without crashing", async () => {
    const response = await fetch(`${activeWebUrl}/seller/wallets`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(
      html.includes("Seller programmable settlement") ||
        html.includes("Choose a seller session to continue") ||
        html.includes("Seller context could not be resolved")
    ).toBe(true);
  });

  it("serves the seller customers route without crashing", async () => {
    const response = await fetch(`${activeWebUrl}/seller/customers`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(
      html.includes("Buyer demand analytics") ||
        html.includes("Choose a seller session to continue") ||
        html.includes("Seller context could not be resolved")
    ).toBe(true);
  });

  it("serves the seller payments route without crashing", async () => {
    const response = await fetch(`${activeWebUrl}/seller/payments`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(
      html.includes("Seller-side lifecycle evidence") ||
        html.includes("Choose a seller session to continue") ||
        html.includes("Seller context could not be resolved")
    ).toBe(true);
  });

  it("serves the seller request csv export route without crashing", async () => {
    const response = await fetch(`${activeWebUrl}/seller/requests/export.csv`);
    const text = await response.text();

    expect([200, 403]).toContain(response.status);
    expect(response.status === 200 ? response.headers.get("content-type")?.includes("text/csv") : text.includes("Seller context could not be resolved")).toBe(true);
  });

  it("serves the seller service detail route without crashing", async () => {
    const response = await fetch(`${activeWebUrl}/seller/services/seller-service-demo-api`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(
      html.includes("Service detail") ||
        html.includes("Choose a seller session to continue") ||
        html.includes("Record not available in this workspace") ||
        html.includes("Seller context could not be resolved")
    ).toBe(true);
  });

  it("serves the seller request detail route without crashing", async () => {
    const response = await fetch(`${activeWebUrl}/seller/requests/phase-0-request-completed`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(
      html.includes("Fulfillment outcome") ||
        html.includes("Request detail") ||
        html.includes("Choose a seller session to continue") ||
        html.includes("Record not available in this workspace") ||
        html.includes("Seller context could not be resolved")
    ).toBe(true);
  });

  it("serves the seller payment detail route without crashing", async () => {
    const response = await fetch(`${activeWebUrl}/seller/payments/phase-0-request-completed`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(
      html.includes("Payment detail") ||
        html.includes("Choose a seller session to continue") ||
        html.includes("Record not available in this workspace") ||
        html.includes("Seller context could not be resolved")
    ).toBe(true);
  });

  it("serves the operator workspace route without crashing", async () => {
    const response = await fetch(`${activeWebUrl}/operator`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(
      html.includes("operator session to continue") ||
        html.includes("Choose a operator session to continue".replace("a operator", "an operator")) ||
        html.includes("Operator context could not be resolved") ||
        html.includes("Operator workspace")
    ).toBe(true);
  });

  it("serves the operator transactions route without crashing", async () => {
    const response = await fetch(`${activeWebUrl}/operator/transactions`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(
      html.includes("Cross-entity transaction ledger") ||
        html.includes("Choose an operator session to continue") ||
        html.includes("Operator context could not be resolved")
    ).toBe(true);
  });

  it("serves the operator organizations route without crashing", async () => {
    const response = await fetch(`${activeWebUrl}/operator/organizations`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(
      html.includes("Platform organization health") ||
        html.includes("Choose an operator session to continue") ||
        html.includes("Operator context could not be resolved")
    ).toBe(true);
  });

  it("serves the operator transaction csv export route without crashing", async () => {
    const response = await fetch(`${activeWebUrl}/operator/transactions/export.csv`);
    const text = await response.text();

    expect([200, 403]).toContain(response.status);
    expect(response.status === 200 ? response.headers.get("content-type")?.includes("text/csv") : text.includes("Operator context could not be resolved")).toBe(true);
  });

  it("serves the operator receipts route without crashing", async () => {
    const response = await fetch(`${activeWebUrl}/operator/receipts`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(
      html.includes("Receipt review") ||
        html.includes("Choose an operator session to continue") ||
        html.includes("Operator context could not be resolved")
    ).toBe(true);
  });

  it("serves the operator exceptions route without crashing", async () => {
    const response = await fetch(`${activeWebUrl}/operator/exceptions`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(
      html.includes("Exception queue") ||
        html.includes("Choose an operator session to continue") ||
        html.includes("Operator context could not be resolved")
    ).toBe(true);
  });

  it("serves the operator audit route without crashing", async () => {
    const response = await fetch(`${activeWebUrl}/operator/audit`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(
      html.includes("Audit explorer") ||
        html.includes("Choose an operator session to continue") ||
        html.includes("Operator context could not be resolved")
    ).toBe(true);
  });

  it("serves the operator exception detail route without crashing", async () => {
    const response = await fetch(`${activeWebUrl}/operator/exceptions/phase-0-request-failed`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(
      html.includes("Operator case detail") ||
        html.includes("Operator case not available") ||
        html.includes("Choose an operator session to continue") ||
        html.includes("Operator context could not be resolved")
    ).toBe(true);
  });

  it("serves the operator receipt detail route without crashing", async () => {
    const response = await fetch(`${activeWebUrl}/operator/receipts/phase-0-request-completed`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(
      html.includes("Receipt detail") ||
        html.includes("Choose an operator session to continue") ||
        html.includes("Record not available in this workspace") ||
        html.includes("Operator context could not be resolved")
    ).toBe(true);
  });

  it("serves the buyer request detail route without crashing", async () => {
    const response = await fetch(`${activeWebUrl}/buyer/requests/phase-0-request-completed`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(
      html.includes("Request detail") ||
        html.includes("Choose a buyer session to continue") ||
        html.includes("Buyer context could not be resolved")
    ).toBe(true);
  });

  it("serves the buyer approval detail route without crashing", async () => {
    const response = await fetch(`${activeWebUrl}/buyer/approvals/phase-0-request-submitted`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(
      html.includes("Approval detail") ||
        html.includes("Choose a buyer session to continue") ||
        html.includes("Record not available in this workspace") ||
        html.includes("Buyer context could not be resolved")
    ).toBe(true);
  });

  it("serves an additional buyer request detail route without crashing", async () => {
    const response = await fetch(`${activeWebUrl}/buyer/requests/phase-0-request-failed`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(
      html.includes("Request detail") ||
        html.includes("Choose a buyer session to continue") ||
        html.includes("Record not available in this workspace") ||
        html.includes("Buyer context could not be resolved")
    ).toBe(true);
  });
});
