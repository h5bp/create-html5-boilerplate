import assert from "node:assert/strict";
import { execFile, spawnSync } from "node:child_process";
import {
  chmod,
  mkdtemp,
  mkdir,
  readFile,
  readlink,
  readdir,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import pacote from "pacote";
import { generate } from "../src/generator.js";

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
  assert.deepEqual(
    (await readdir(tmp)).filter((name) =>
      name.startsWith("html5-boilerplate-staging"),
    ),
    [],
  );
}

test("copies all staged files with their contents and permissions", async (t) => {
  const work = await workspace(t);
  const destination = path.join(work.cwd, "nested", "site");
  await mkdir(destination, { recursive: true });
  await writeFile(path.join(destination, "index.html"), "old");
  await chmod(path.join(destination, "index.html"), 0o600);
  await writeFile(path.join(destination, "keep.txt"), "keep");
  let staging;
  let copied = false;
  const files = {
    "index.html": '<html lang="en">fixture</html>\n',
    ".npmignore": "node_modules\n",
    "assets/.npmignore": "generated\n",
    "assets/script.js": "console.log('fixture');\n",
  };
  t.mock.method(pacote, "extract", async (spec, dir) => {
    assert.equal(spec, "html5-boilerplate@fixture");
    staging = dir;
    for (const [name, content] of Object.entries(files)) {
      const file = path.join(dir, "dist", name);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, content);
    }
    await chmod(path.join(dir, "dist", "index.html"), 0o644);
    await chmod(path.join(dir, "dist", "assets", "script.js"), 0o755);
    if (process.platform !== "win32") {
      await symlink("script.js", path.join(dir, "dist", "assets", "link.js"));
    }
    return { from: spec };
  });

  await generate({
    destination,
    version: "fixture",
    skipConfiguration: true,
    onCopied: async () => {
      copied = true;
      for (const [name, content] of Object.entries(files)) {
        const source = path.join(staging, "dist", name);
        const target = path.join(destination, name);
        assert.deepEqual(await readFile(target), Buffer.from(content));
        if (process.platform !== "win32") {
          assert.equal(
            (await stat(target)).mode & 0o777,
            (await stat(source)).mode & 0o777,
          );
        }
      }
    },
  });

  assert.equal(copied, true);
  assert.deepEqual((await readdir(destination)).sort(), [
    ".gitignore",
    "assets",
    "index.html",
    "keep.txt",
  ]);
  assert.deepEqual((await readdir(path.join(destination, "assets"))).sort(), [
    ".gitignore",
    ...(process.platform !== "win32" ? ["link.js"] : []),
    "script.js",
  ]);
  if (process.platform !== "win32") {
    assert.equal(
      await readlink(path.join(destination, "assets", "link.js")),
      "script.js",
    );
    assert.equal(
      await readFile(path.join(destination, "assets", "link.js"), "utf8"),
      files["assets/script.js"],
    );
  }
  assert.equal(
    await readFile(path.join(destination, "keep.txt"), "utf8"),
    "keep",
  );
  for (const [name, content] of Object.entries(files)) {
    const target = name.replace(/\.npmignore$/, ".gitignore");
    assert.equal(
      await readFile(path.join(destination, target), "utf8"),
      content,
    );
    if (name !== target) {
      await assert.rejects(stat(path.join(destination, name)), {
        code: "ENOENT",
      });
    }
  }
  await assert.rejects(stat(staging), { code: "ENOENT" });
});

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

test("concurrent generators use separate staging directories", async (t) => {
  const work = await workspace(t);
  const generatorUrl = new URL("../src/generator.js", import.meta.url).href;
  const script = `
    const { generate } = await import(${JSON.stringify(generatorUrl)});
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const tmp = process.env.TMPDIR;
    let copied = 0;
    let checked = 0;
    let release;
    let releaseChecks;
    const bothCopied = new Promise((resolve) => { release = resolve; });
    const bothChecked = new Promise((resolve) => { releaseChecks = resolve; });
    const results = await Promise.all(["first", "second"].map((site) =>
      generate({
        destination: path.join(process.argv[1], site),
        version: "7.3.0",
        skipConfiguration: true,
        onCopied: async () => {
          if (++copied === 2) release();
          await bothCopied;
          const staging = (await fs.readdir(tmp)).filter((name) =>
            name.startsWith("html5-boilerplate-staging-")
          );
          if (staging.length !== 2) throw new Error("Expected two staging directories");
          if (++checked === 2) releaseChecks();
          await bothChecked;
        },
      })
    ));
    console.log(JSON.stringify(results));
  `;
  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    ["--input-type=module", "-e", script, work.cwd],
    {
      env: { ...process.env, TMPDIR: work.tmp, TMP: work.tmp, TEMP: work.tmp },
      timeout: 30000,
    },
  );
  const results = JSON.parse(stdout);
  assert.equal(results.length, 2);
  for (const site of ["first", "second"]) {
    await stat(path.join(work.cwd, site, "index.html"));
  }
  assert.equal(stderr, "");
  await assertStagingRemoved(work.tmp);
});

test("copies over existing files while retaining unrelated files", async (t) => {
  const work = await workspace(t);
  const destination = path.join(work.cwd, "site");
  await mkdir(destination);
  await writeFile(path.join(destination, "index.html"), "old content", "utf8");
  await writeFile(path.join(destination, "keep.txt"), "keep", "utf8");
  await runCli(work, ["site", "-r=7.3.0", "-y"]);
  assert.match(
    await readFile(path.join(destination, "index.html"), "utf8"),
    /<html/,
  );
  assert.equal(
    await readFile(path.join(destination, "keep.txt"), "utf8"),
    "keep",
  );
  await assertStagingRemoved(work.tmp);
});

test("reports destination collisions and cleans up staging", async (t) => {
  const work = await workspace(t);
  const destination = path.join(work.cwd, "site");
  await writeFile(destination, "keep", "utf8");
  await assert.rejects(runCli(work, ["site", "-r=7.3.0", "-y"]), (error) => {
    assert.equal(error.code, 1);
    assert.match(error.stderr, /Could not generate project at/);
    assert.match(error.stderr, /ERR_FS_CP_DIR_TO_NON_DIR/);
    return true;
  });
  assert.equal(await readFile(destination, "utf8"), "keep");
  await assertStagingRemoved(work.tmp);
});

test("reports filesystem errors when checking a destination", async (t) => {
  const work = await workspace(t);
  await writeFile(path.join(work.cwd, "file"), "keep", "utf8");
  await assert.rejects(runCli(work, ["file/site"]), (error) => {
    assert.equal(error.code, 1);
    assert.match(error.stderr, /ENOTDIR/);
    return true;
  });
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
