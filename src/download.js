import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import pickManifest from "npm-pick-manifest";
import ssri from "ssri";
import * as tar from "tar";

const timeout = 15_000;
const headers = { "User-Agent": "create-html5-boilerplate" };

async function request(url, description, consume, extraHeaders = {}) {
  const signal = AbortSignal.timeout(timeout);
  try {
    const response = await fetch(url, {
      headers: { ...headers, ...extraHeaders },
      signal,
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(
        `${description}: ${response.status} ${response.statusText}`,
      );
    }
    return await consume(response, signal);
  } catch (error) {
    if (
      signal.aborted ||
      error.name === "AbortError" ||
      error.name === "TimeoutError"
    ) {
      throw new Error(
        `${description}: Network request timed out or was aborted. Please check your internet connection or proxy settings.`,
        { cause: error },
      );
    }
    if (
      error instanceof TypeError &&
      (error.message === "fetch failed" || error.message === "terminated")
    ) {
      throw new Error(
        `${description}: Network request failed. Please check your internet connection or proxy settings.`,
        { cause: error },
      );
    }
    throw error;
  }
}

export async function downloadRelease(version, staging, archive) {
  const registry =
    process.env.npm_config_registry || "https://registry.npmjs.org/";
  const metadataUrl = new URL(
    "html5-boilerplate",
    registry.endsWith("/") ? registry : `${registry}/`,
  );
  const metadata = await request(
    metadataUrl,
    "Failed to fetch release metadata",
    async (response) => {
      try {
        return await response.json();
      } catch (error) {
        if (error instanceof SyntaxError) {
          throw new Error(
            "Invalid release metadata received from npm registry",
            {
              cause: error,
            },
          );
        }
        throw error;
      }
    },
    { Accept: "application/vnd.npm.install-v1+json" },
  );
  const manifest = pickManifest(metadata, version);
  const { tarball, integrity, shasum } = manifest.dist || {};
  if (!tarball || (!integrity && !shasum)) {
    throw new Error(
      `Missing archive URL or integrity for html5-boilerplate@${manifest.version}`,
    );
  }
  const expectedIntegrity =
    integrity || ssri.fromHex(shasum, "sha1").toString();
  if (!ssri.parse(expectedIntegrity)) {
    throw new Error(
      `Invalid archive integrity for html5-boilerplate@${manifest.version}`,
    );
  }
  await request(
    tarball,
    `Failed to download template archive from ${tarball}`,
    async (response, signal) => {
      if (!response.body) {
        throw new Error(
          `Template archive response from ${tarball} has no body`,
        );
      }
      await pipeline(
        Readable.fromWeb(response.body),
        ssri.integrityStream({ integrity: expectedIntegrity }),
        createWriteStream(archive),
        { signal },
      );
    },
  );
  await tar.extract({ file: archive, cwd: staging, strip: 1, strict: true });
  return `html5-boilerplate@${version}`;
}
