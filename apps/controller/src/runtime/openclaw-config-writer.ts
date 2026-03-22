import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { OpenClawConfig } from "@nexu/shared";
import type { ControllerEnv } from "../app/env.js";
import { logger } from "../lib/logger.js";

export class OpenClawConfigWriter {
  /** Last successfully written content — used to skip redundant writes. */
  private lastWrittenContent: string | null = null;

  constructor(private readonly env: ControllerEnv) {}

  async write(config: OpenClawConfig): Promise<void> {
    await mkdir(path.dirname(this.env.openclawConfigPath), { recursive: true });
    const content = `${JSON.stringify(config, null, 2)}\n`;

    // Skip writing if the content hasn't changed since the last write.
    // This prevents OpenClaw's file watcher from triggering unnecessary
    // reloads/restarts when syncAll() is called without actual config changes
    // (e.g. on WS reconnect after a restart).
    if (content === this.lastWrittenContent) {
      logger.debug(
        { path: this.env.openclawConfigPath },
        "openclaw_config_write_skipped_unchanged",
      );
      return;
    }

    const writeStartedAt = Date.now();
    logger.info(
      {
        path: this.env.openclawConfigPath,
        contentLength: content.length,
        startedAt: writeStartedAt,
      },
      "openclaw_config_write_begin",
    );
    await writeFile(this.env.openclawConfigPath, content, "utf8");
    this.lastWrittenContent = content;
    const configStat = await stat(this.env.openclawConfigPath);
    logger.info(
      {
        path: this.env.openclawConfigPath,
        contentLength: content.length,
        inode: configStat.ino,
        size: configStat.size,
        mtimeMs: configStat.mtimeMs,
        finishedAt: Date.now(),
        durationMs: Date.now() - writeStartedAt,
      },
      "openclaw_config_write_complete",
    );
  }
}
