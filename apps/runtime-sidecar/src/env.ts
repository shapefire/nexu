import { z } from "zod";

const envSchema = z.object({
  RUNTIME_POOL_ID: z.string().min(1),
  INTERNAL_TRPC_TOKEN: z.string().min(1),
  OPENCLAW_CONFIG_PATH: z.string().min(1),
  RUNTIME_API_BASE_URL: z.string().url().default("http://localhost:3000"),
  RUNTIME_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(2000),
  RUNTIME_POLL_JITTER_MS: z.coerce.number().int().nonnegative().default(300),
  RUNTIME_MAX_BACKOFF_MS: z.coerce.number().int().positive().default(30000),
  RUNTIME_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(3000),
  RUNTIME_HEARTBEAT_INTERVAL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(5000),
  RUNTIME_POD_IP: z.string().optional(),
  OPENCLAW_GATEWAY_READY_URL: z.string().url().optional(),
});

export const env = envSchema.parse(process.env);
