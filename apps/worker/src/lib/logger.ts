export function log(message: string, context?: unknown) {
  if (context === undefined) {
    console.log(`[worker] ${message}`);
    return;
  }

  console.log(`[worker] ${message}`, context);
}
