import assert from "node:assert/strict";
import { execFile, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import "../src/generator.js";

// Register the CLI as a dependency so test watch mode reruns on source changes.
import "../src/cli.js";

const execFileAsync = promisify(execFile);
const entry = fileURLToPath(new URL("../index.js", import.meta.url));
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
  return execFileAsync(process.execPath, [entry, ...args], {
    cwd,
    env: { ...process.env, TMPDIR: tmp, TMP: tmp, TEMP: tmp, NO_COLOR: "1" },
  });
}

async function assertStagingRemoved(tmp) {
  await assert.rejects(stat(path.join(tmp, "html5-boilerplate-staging")), {
    code: "ENOENT",
  });
}

test("generates independently of CLI arguments", async (t) => {
  const work = await workspace(t);
  const destination = path.join(work.cwd, "api-site");
  const generatorUrl = new URL("../src/generator.js", import.meta.url).href;
  const script = `
    const destination = process.argv[1];
    process.argv = ["node", "unrelated-command", "--release=invalid"];
    const { generate } = await import(${JSON.stringify(generatorUrl)});
    const result = await generate({ destination, version: "7.3.0", lang: "fr" });
    console.log(JSON.stringify({ result, argv: process.argv }));
  `;
  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    ["--input-type=module", "-e", script, destination],
    {
      env: { ...process.env, TMPDIR: work.tmp, TMP: work.tmp, TEMP: work.tmp },
    },
  );
  const { result, argv } = JSON.parse(stdout);
  assert.equal(result.destination, destination);
  assert.match(result.nameWithVersion, /html5-boilerplate@7\.3\.0/);
  assert.match(
    await readFile(path.join(destination, "index.html"), "utf8"),
    /lang="fr"/,
  );
  assert.deepEqual(argv, ["node", "unrelated-command", "--release=invalid"]);
  assert.equal(stderr, "");
  await assertStagingRemoved(work.tmp);
});

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
        ["-r=6..2.3", /ETARGET/],
        ["-r=6..2.3,7.2.3", /Error:/],
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

test("accepts positional targets and release aliases", async (t) => {
  for (const releaseArgs of [
    ["--release", "7.3.0", "--yes"],
    ["-r", "7.3.0", "-y"],
    ["-yr=7.3.0"],
  ]) {
    await t.test(releaseArgs.join(" "), async (t) => {
      const work = await workspace(t);
      const { stdout, stderr } = await runCli(work, [
        "my-site",
        ...releaseArgs,
      ]);
      assert.equal(stdout.trim(), path.join(work.cwd, "my-site"));
      assert.match(stderr, /html5-boilerplate@7\.3\.0 copied to/);
      await stat(path.join(work.cwd, "my-site/index.html"));
      await assertStagingRemoved(work.tmp);
    });
  }
});

test("treats arguments after -- as positional targets", async (t) => {
  const work = await workspace(t);
  const target = path.join(work.cwd, "-r=site");
  const { stdout, stderr } = await runCli(work, [
    "--release=7.3.0",
    "-y",
    "--",
    "-r=site",
  ]);
  assert.equal(stdout.trim(), target);
  assert.match(stderr, /html5-boilerplate@7\.3\.0 copied to/);
  await stat(path.join(target, "index.html"));
  await assertStagingRemoved(work.tmp);
});

test("--no-yes overrides --yes and restores the existing-directory prompt", async (t) => {
  const work = await workspace(t);
  await mkdir(path.join(work.cwd, "my-site"));
  const result = spawnSync(
    process.execPath,
    [entry, "my-site", "--yes", "--no-yes"],
    {
      cwd: work.cwd,
      input: "n\n",
      encoding: "utf8",
      env: { ...process.env, TMPDIR: work.tmp, NO_COLOR: "1" },
    },
  );
  assert.ifError(result.error);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /is not an empty folder, proceed\?/);
  assert.match(result.stdout, /Aborted/);
  assert.deepEqual(await readdir(path.join(work.cwd, "my-site")), []);
  await assertStagingRemoved(work.tmp);
});

test("explicit yes values do not skip prompts", async (t) => {
  const work = await workspace(t);
  await mkdir(path.join(work.cwd, "my-site"));
  for (const flag of ["--yes=false", "--yes=true", "-y=false"]) {
    const result = spawnSync(process.execPath, [entry, "my-site", flag], {
      cwd: work.cwd,
      input: "n\n",
      encoding: "utf8",
      env: { ...process.env, TMPDIR: work.tmp, NO_COLOR: "1" },
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /is not an empty folder, proceed\?/);
    assert.match(result.stdout, /Aborted/);
  }
  assert.deepEqual(await readdir(path.join(work.cwd, "my-site")), []);
  await assertStagingRemoved(work.tmp);
});

test("help and version flags exit without generating a project", async (t) => {
  const work = await workspace(t);
  const { version } = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );
  for (const flag of ["--help", "-h", "--version", "-v"]) {
    const { stdout, stderr } = await runCli(work, ["my-site", flag]);
    if (flag === "--help" || flag === "-h") {
      assert.match(stdout, /Usage: create-html5-boilerplate/);
      assert.match(stdout, /--release/);
    } else {
      assert.equal(stdout.trim(), version);
    }
    assert.equal(stderr, "");
  }
  await assert.rejects(stat(path.join(work.cwd, "my-site")), {
    code: "ENOENT",
  });
  await assertStagingRemoved(work.tmp);
});

test("invalid arguments fail cleanly before generating a project", async (t) => {
  const work = await workspace(t);
  for (const args of [
    ["my-site", "--unknown"],
    ["my-site", "-z"],
    ["my-site", "--release"],
    ["my-site", "-r"],
    ["my-site", "--release", "-y"],
    ["my-site", "--lang"],
    ["my-site", "--help=invalid"],
  ]) {
    await assert.rejects(runCli(work, args), (error) => {
      assert.equal(error.code, 1);
      assert.equal(error.stdout, "");
      assert.match(error.stderr, /^Error: /);
      assert.doesNotMatch(error.stderr, /\n\s+at /);
      return true;
    });
  }
  await assert.rejects(stat(path.join(work.cwd, "my-site")), {
    code: "ENOENT",
  });
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
