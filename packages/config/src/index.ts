function readNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const atlasProduct = {
  name: "Atlas Agent Payments OS",
  summary: "Premium controls for managed AI agent spend across paid APIs and digital services."
} as const;

export const premiumSurfaces = [
  { href: "/buyer", label: "Controls", title: "Buyer workspace" },
  { href: "/seller", label: "Services", title: "Seller workspace" },
  { href: "/operator", label: "Oversight", title: "Operator workspace" }
] as const;

export const apiRuntime = {
  port: readNumber(process.env.API_PORT, 4000)
} as const;

export const workerRuntime = {
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379"
} as const;

export const storageRuntime = {
  endpoint: process.env.MINIO_ENDPOINT ?? "localhost",
  port: readNumber(process.env.MINIO_PORT, 9000),
  useSsl: process.env.MINIO_USE_SSL === "true",
  accessKey: process.env.MINIO_ACCESS_KEY ?? "atlasminio",
  secretKey: process.env.MINIO_SECRET_KEY ?? "atlasminio",
  bucketReceipts: process.env.MINIO_BUCKET_RECEIPTS ?? "atlas-receipts"
} as const;
