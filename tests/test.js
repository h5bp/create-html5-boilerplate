import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

// Register the CLI as a dependency so test watch mode reruns on source changes.
import "../lib/cli.js";

const execFileAsync = promisify(execFile);
const cliUrl = new URL("../lib/cli.js", import.meta.url).href;
const runner = `
  const { default: cli } = await import(process.argv[1]);
  try {
    await cli(process.argv.slice(2));
  } catch (error) {
    console.error("CLI_ERROR:", error);
    process.exitCode = 1;
  }
`;
const versions = [
  null,
  "-r=latest",
  "-r=7",
  "-r=7.2.0",
  "-r=v7.2.0",
  "-r=v7.2",
  "--release=7.3.0",
  ...[
    "0.0.1",
    "5.3.0",
    "6.0.0",
    "6.0.1",
    "6.1.0",
    "7.0.0",
    "7.0.1",
    "7.1.0",
    "7.2.0",
    "7.3.0",
    "8.0.0",
  ].map((version) => `-r=${version}`),
];

async function workspace(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "create-h5bp-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const cwd = path.join(root, "cwd");
  const tmp = path.join(root, "tmp");
  await Promise.all([mkdir(cwd), mkdir(tmp)]);
  return { cwd, tmp };
}

async function runCli({ cwd, tmp }, args) {
  return execFileAsync(
    process.execPath,
    ["--input-type=module", "-e", runner, cliUrl, ...args],
    {
      cwd,
      env: { ...process.env, TMPDIR: tmp, TMP: tmp, TEMP: tmp, NO_COLOR: "1" },
    },
  );
}

async function assertStagingRemoved(tmp) {
  await assert.rejects(stat(path.join(tmp, "html5-boilerplate-staging")), {
    code: "ENOENT",
  });
}

test("downloads supported releases", { concurrency: 4 }, async (t) => {
  await Promise.all(
    versions.map((version) =>
      t.test(`Downloading ${version || "default"}`, async (t) => {
        const work = await workspace(t);
        const target = version ? path.join(work.cwd, "site") : work.cwd;
        const args = version ? ["site", version, "-y"] : ["-y"];
        const { stdout, stderr } = await runCli(work, args);
        assert.equal(stdout.trim(), target);
        assert.match(stderr, /copied to/);
        assert.ok((await readdir(target)).length >= 7);
        for (const entry of ["index.html", "robots.txt", "css", "js", "img"]) {
          await stat(path.join(target, entry));
        }
        if (version && version !== "-r=latest") {
          let expected = version.replace(/(-r=|--release=|v)/gi, "");
          if (expected === "7.0.0") expected = "6.1.0";
          if (expected === "0.0.1") expected = "5.3.0";
          const css = await readFile(path.join(target, "css/main.css"), "utf8");
          assert.ok(css.includes(`HTML5 Boilerplate v${expected}`));
          for (const entry of ["tile.png", ".gitignore", "img/.gitignore"]) {
            await stat(path.join(target, entry));
          }
        }
        await assertStagingRemoved(work.tmp);
      }),
    ),
  );
});

test(
  "invalid releases surface errors and remove staging",
  { concurrency: 2 },
  async (t) => {
    await Promise.all(
      [
        ["-r=6..2.3", /CLI_ERROR: ETARGET/],
        ["-r=6..2.3,7.2.3", /CLI_ERROR: Error:/],
      ].map(([version, message]) =>
        t.test(version, async (t) => {
          const work = await workspace(t);
          await assert.rejects(
            runCli(work, ["site", version, "-y"]),
            (error) => {
              assert.match(error.stderr, message);
              return true;
            },
          );
          await assertStagingRemoved(work.tmp);
        }),
      ),
    );
  },
);

test("applies an explicit language", async (t) => {
  const work = await workspace(t);
  await runCli(work, ["site", "--lang=en-US"]);
  const html = await readFile(path.join(work.cwd, "site/index.html"), "utf8");
  assert.ok(html.includes('lang="en-US"'));
  await assertStagingRemoved(work.tmp);
});

test("the published entry point rejects unsupported Node.js versions", async () => {
  const entry = new URL("../index.js", import.meta.url).href;
  for (const version of ["14.0.0", "16.0.0", "18.0.0", "19.9.0"]) {
    await assert.rejects(
      execFileAsync(process.execPath, [
        "--input-type=module",
        "-e",
        `Object.defineProperty(process.versions, "node", { value: "${version}" }); await import(${JSON.stringify(entry)});`,
      ]),
      (error) => {
        assert.equal(error.code, 1);
        assert.match(error.stderr, /Node\.js 20 or higher is required/);
        return true;
      },
    );
  }
});

test("the published entry point downloads a release", async (t) => {
  const work = await workspace(t);
  const entry = new URL("../index.js", import.meta.url);
  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    [fileURLToPath(entry), "site", "-r=7.3.0", "--yes"],
    {
      cwd: work.cwd,
      env: {
        ...process.env,
        TMPDIR: work.tmp,
        TMP: work.tmp,
        TEMP: work.tmp,
        NO_COLOR: "1",
      },
    },
  );
  assert.equal(stdout.trim(), path.join(work.cwd, "site"));
  assert.match(stderr, /html5-boilerplate@7\.3\.0 copied to/);
  await stat(path.join(work.cwd, "site/index.html"));
  await assertStagingRemoved(work.tmp);
});
