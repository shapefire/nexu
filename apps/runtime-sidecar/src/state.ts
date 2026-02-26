export type RuntimeStatus = "active" | "degraded" | "unhealthy";

export interface RuntimeState {
  status: RuntimeStatus;
  lastSeenVersion: number;
  lastConfigHash: string;
}

export function createRuntimeState(): RuntimeState {
  return {
    status: "active",
    lastSeenVersion: 0,
    lastConfigHash: "",
  };
}
