import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { test } from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const logger = new URL("../src/logger.js", import.meta.url).href;
const baseEnv = { ...process.env };
delete baseEnv.DEBUG;

test("diagnostics use the correct streams and hide debug details by default", async () => {
  const script = `
    const logger = await import(${JSON.stringify(logger)});
    logger.info("Ready");
    logger.warn("Careful", { path: "/tmp/site", hint: "Choose another path." });
    logger.error("Download failed", {
      version: "latest",
      reason: "network timeout",
      hint: "Check your connection.",
      error: new Error("private detail"),
    });
    logger.debug("Hidden", { value: 42 });
  `;
  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    ["--input-type=module", "-e", script],
    { env: baseEnv },
  );
  assert.equal(stdout, "Ready\n");
  assert.match(stderr, /Warning: Careful\n\nPath: \/tmp\/site\nHint:/);
  assert.match(
    stderr,
    /Download failed\n\nVersion: latest\nReason: network timeout\nHint: Check your connection\./,
  );
  assert.doesNotMatch(stderr, /private detail|Debug:| at /);
});

test("debug output is opt-in via the environment or flag", async () => {
  const script = `
    const logger = await import(${JSON.stringify(logger)});
    logger.error("Failed", new Error("detail"));
    logger.debug("State", { value: 42 });
  `;
  for (const [args, env] of [
    [[], { ...baseEnv, DEBUG: "1" }],
    [["--debug"], baseEnv],
  ]) {
    const { stderr } = await execFileAsync(
      process.execPath,
      ["--input-type=module", "-e", script, "entry", ...args],
      { env },
    );
    assert.match(stderr, /Failed\n\nReason: detail/);
    assert.match(stderr, /Debug: Error details\nError: detail\n\s+at /);
    assert.match(stderr, /Debug: State\n\{ value: 42 \}/);
  }
});
