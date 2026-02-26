import { registerPool } from "./api";
import { waitGatewayReady } from "./config";
import { env } from "./env";
import { log } from "./log";
import { runHeartbeatLoop, runPollLoop } from "./loops";
import { createRuntimeState } from "./state";

const state = createRuntimeState();

async function main(): Promise<void> {
  log("starting runtime sidecar", { poolId: env.RUNTIME_POOL_ID });
  await waitGatewayReady();
  await registerPool();
  log("pool registered", { poolId: env.RUNTIME_POOL_ID });

  void runHeartbeatLoop(state);
  await runPollLoop(state);
}

main().catch((error: unknown) => {
  console.error("[runtime-sidecar] fatal error", {
    error: error instanceof Error ? error.message : "unknown_error",
  });
  process.exitCode = 1;
});
