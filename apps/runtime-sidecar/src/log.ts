export function log(message: string, context?: Record<string, unknown>): void {
  if (context) {
    console.log(`[runtime-sidecar] ${message}`, context);
    return;
  }

  console.log(`[runtime-sidecar] ${message}`);
}
