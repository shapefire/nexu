import { sendHeartbeat } from "./api";
import { pollLatestConfig } from "./config";
import { env } from "./env";
import { log } from "./log";
import type { RuntimeState } from "./state";
import { sleep } from "./utils";

export async function runHeartbeatLoop(state: RuntimeState): Promise<never> {
  for (;;) {
    try {
      await sendHeartbeat(state);
    } catch (error) {
      log("heartbeat failed", {
        error: error instanceof Error ? error.message : "unknown_error",
      });
    }

    await sleep(env.RUNTIME_HEARTBEAT_INTERVAL_MS);
  }
}

export async function runPollLoop(state: RuntimeState): Promise<never> {
  let backoffMs = env.RUNTIME_POLL_INTERVAL_MS;

  for (;;) {
    try {
      const changed = await pollLatestConfig(state);
      backoffMs = env.RUNTIME_POLL_INTERVAL_MS;

      const jitter = Math.floor(
        Math.random() * (env.RUNTIME_POLL_JITTER_MS + 1),
      );
      await sleep(env.RUNTIME_POLL_INTERVAL_MS + jitter);

      if (changed) {
        await sendHeartbeat(state);
      }
    } catch (error) {
      state.status = "degraded";
      log("config poll failed", {
        error: error instanceof Error ? error.message : "unknown_error",
        retryInMs: backoffMs,
      });
      await sleep(backoffMs);
      backoffMs = Math.min(backoffMs * 2, env.RUNTIME_MAX_BACKOFF_MS);
    }
  }
}
