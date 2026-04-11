import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const requestedPort = 3401 + Math.floor(Math.random() * 200);

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

function parseExistingServerUrl(logs: string) {
  const match = logs.match(/Another next dev server is already running\.[\s\S]*?- Local:\s+(http:\/\/(?:localhost|127\.0\.0\.1):\d+)/);
  return match?.[1] ?? null;
}

describe("marketing e2e", () => {
  let serverProcess: ChildProcessWithoutNullStreams | null = null;
  let serverLogs = "";
  let activeWebUrl = `http://127.0.0.1:${requestedPort}`;

  beforeAll(async () => {
    serverProcess = spawn(
      process.platform === "win32" ? "pnpm.cmd" : "pnpm",
      ["exec", "next", "dev", "--hostname", "127.0.0.1", "--port", String(requestedPort)],
      {
        cwd: process.cwd(),
        stdio: "pipe"
      }
    );

    serverProcess.stdout.on("data", (chunk) => {
      serverLogs += chunk.toString();
    });
    serverProcess.stderr.on("data", (chunk) => {
      serverLogs += chunk.toString();
    });

    const requestedStarted = await waitForHttp(activeWebUrl, 15000);

    if (requestedStarted) {
      return;
    }

    const existingServerUrl = parseExistingServerUrl(serverLogs);

    if (existingServerUrl) {
      activeWebUrl = existingServerUrl.replace("localhost", "127.0.0.1");
      const existingStarted = await waitForHttp(activeWebUrl, 30000);

      if (existingStarted) {
        return;
      }
    }

    throw new Error(`Could not start or discover a usable web server.\n${serverLogs}`);
  });

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

  it("serves the seller workspace route without crashing", async () => {
    const response = await fetch(`${activeWebUrl}/seller`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(
      html.includes("Choose a seller session to continue") ||
        html.includes("Seller context could not be resolved") ||
        html.includes("Seller workspace")
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
