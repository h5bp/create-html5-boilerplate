import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { downloadRelease } from "../src/download.js";

const execFileAsync = promisify(execFile);
const entry = fileURLToPath(new URL("../index.js", import.meta.url));

async function workspace(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "h5bp-download-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

function metadata(dist) {
  return {
    name: "html5-boilerplate",
    "dist-tags": { latest: "1.0.0" },
    versions: {
      "1.0.0": { name: "html5-boilerplate", version: "1.0.0", dist },
    },
  };
}

test("requests npm metadata with native fetch and reports HTTP errors", async (t) => {
  const root = await workspace(t);
  for (const status of [404, 429, 500]) {
    await t.test(`HTTP ${status}`, async (t) => {
      t.mock.method(globalThis, "fetch", async (url, options) => {
        assert.match(String(url), /\/html5-boilerplate$/);
        assert.equal(options.headers["User-Agent"], "create-html5-boilerplate");
        assert.equal(
          options.headers.Accept,
          "application/vnd.npm.install-v1+json",
        );
        assert.ok(options.signal instanceof AbortSignal);
        return new Response(null, { status, statusText: "Registry error" });
      });
      await assert.rejects(
        downloadRelease("latest", root, path.join(root, "archive.tgz")),
        new RegExp(
          `Failed to fetch release metadata: ${status} Registry error`,
        ),
      );
    });
  }
});

test("reports archive HTTP errors and verifies integrity", async (t) => {
  const root = await workspace(t);
  for (const status of [404, 429, 500, 200]) {
    await t.test(`HTTP ${status}`, async (t) => {
      let calls = 0;
      t.mock.method(globalThis, "fetch", async (url, options) => {
        assert.ok(options.signal instanceof AbortSignal);
        if (++calls === 1) {
          return Response.json(
            metadata({
              tarball: "https://example.test/archive.tgz",
              integrity:
                "sha512-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==",
            }),
          );
        }
        assert.equal(url, "https://example.test/archive.tgz");
        assert.equal(options.headers["User-Agent"], "create-html5-boilerplate");
        return status === 200
          ? new Response("corrupt archive")
          : new Response(null, { status, statusText: "Archive error" });
      });
      await assert.rejects(
        downloadRelease("latest", root, path.join(root, "archive.tgz")),
        status === 200
          ? /integrity|checksum/i
          : new RegExp(
              `Failed to download template archive.*${status} Archive error`,
            ),
      );
      assert.equal(calls, 2);
    });
  }
});

test("rejects malformed metadata and archive integrity", async (t) => {
  const root = await workspace(t);
  for (const [response, message] of [
    [new Response("not JSON"), /Invalid release metadata/],
    [
      Response.json(
        metadata({ tarball: "https://example.test/a", integrity: "invalid" }),
      ),
      /Invalid archive integrity/,
    ],
  ]) {
    await t.test(String(message), async (t) => {
      const fetch = t.mock.method(globalThis, "fetch", async () => response);
      await assert.rejects(
        downloadRelease("latest", root, path.join(root, "archive.tgz")),
        message,
      );
      assert.equal(fetch.mock.callCount(), 1);
    });
  }
});

test("reports network failures and timeouts during requests and response streams", async (t) => {
  const root = await workspace(t);
  await t.test("connection failure", async (t) => {
    t.mock.method(globalThis, "fetch", async () => {
      throw new TypeError("fetch failed");
    });
    await assert.rejects(
      downloadRelease("latest", root, path.join(root, "a")),
      /Network request failed.*internet connection or proxy settings/,
    );
  });
  await t.test("interrupted metadata response", async (t) => {
    t.mock.method(
      globalThis,
      "fetch",
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.error(new TypeError("terminated"));
            },
          }),
        ),
    );
    await assert.rejects(
      downloadRelease("latest", root, path.join(root, "a")),
      /Failed to fetch release metadata: Network request failed/,
    );
  });
  for (const phase of ["metadata", "archive"]) {
    await t.test(`${phase} timeout`, async (t) => {
      const controller = new AbortController();
      t.mock.method(AbortSignal, "timeout", (milliseconds) => {
        assert.equal(milliseconds, 15_000);
        return controller.signal;
      });
      let calls = 0;
      t.mock.method(globalThis, "fetch", async () => {
        if (phase === "archive" && ++calls === 1) {
          return Response.json(
            metadata({
              tarball: "https://example.test/archive.tgz",
              integrity:
                "sha512-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==",
            }),
          );
        }
        if (phase === "metadata") {
          controller.abort();
          throw new DOMException("Aborted", "AbortError");
        }
        return new Response(
          new ReadableStream({
            start() {
              controller.abort();
            },
          }),
        );
      });
      await assert.rejects(
        downloadRelease("latest", root, path.join(root, "a")),
        /Network request timed out or was aborted.*internet connection or proxy settings/,
      );
    });
  }
});

test("CLI prints network errors without an unhandled rejection and removes staging", async (t) => {
  const root = await workspace(t);
  const tmp = path.join(root, "tmp");
  await mkdir(tmp);
  const preload = path.join(root, "preload.mjs");
  const scenarios = [
    [
      `globalThis.fetch = async () => new Response(null, { status: 429, statusText: "Too Many Requests" });`,
      /Failed to fetch release metadata: 429 Too Many Requests/,
    ],
    [
      `let calls = 0; globalThis.fetch = async () => ++calls === 1
        ? Response.json(${JSON.stringify(
          metadata({
            tarball: "https://example.test/archive.tgz",
            integrity:
              "sha512-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==",
          }),
        )})
        : new Response(null, { status: 500, statusText: "Server Error" });`,
      /Failed to download template archive.*500 Server Error/,
    ],
    [
      `globalThis.fetch = async () => { throw new DOMException("Aborted", "TimeoutError"); };`,
      /Network request timed out or was aborted.*internet connection or proxy settings/,
    ],
  ];
  for (const [source, message] of scenarios) {
    await writeFile(preload, source);
    await assert.rejects(
      execFileAsync(
        process.execPath,
        ["--import", preload, entry, "site", "-y"],
        {
          cwd: root,
          env: {
            ...process.env,
            TMPDIR: tmp,
            TMP: tmp,
            TEMP: tmp,
            NO_COLOR: "1",
          },
        },
      ),
      (error) => {
        assert.equal(error.code, 1);
        assert.match(error.stderr, message);
        assert.doesNotMatch(error.stderr, /UnhandledPromiseRejection|\n\s+at /);
        return true;
      },
    );
    assert.deepEqual(await readdir(tmp), []);
  }
});
