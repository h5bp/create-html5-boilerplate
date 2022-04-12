/**
 * @jest-environment node
 */

import fs from "fs-extra";
import os from "os";
import path from "path";
import cli from "../lib/cli";

const packageName = "html5-boilerplate";
const tempDir = `${os.tmpdir()}/${packageName}-staging`;
const defaultDir = "./out/default_dir";

// TODO: fetch all versions:
// const { packument } = require('pacote');
// const versions = await packument(packageName);
// cases = ['', 'latest', '-r=7.3.0', ...Object.keys(versions)];
const allVersions = [
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
];
const cases = [
  null,
  "-r=latest",
  "-r=7",
  "-r=7.2.0",
  "-r=v7.2.0",
  "-r=v7.2",
  "--release=7.3.0",
  ...allVersions.map((v) => `-r=${v}`),
];

const outputFolder = (version = null) => `./out/${version || "default_dir"}`;

const runCli = async ({
  version = null,
  dir = null,
  skip = false,
  lang = null,
}) => {
  let argvs = [];
  let prevCwd;
  if (dir) {
    argvs.push(`./out/${dir}`);
  } else {
    await fs.ensureDir(defaultDir);
    prevCwd = process.cwd();
    process.chdir(defaultDir);
  }

  if (version) {
    argvs.push(version);
  }
  if (skip) {
    argvs.push("-y");
  }
  if (lang) {
    argvs.push("--lang=" + lang);
  }
  // console.log(process.cwd());
  // process.exit(0);
  await cli(argvs);
  if (prevCwd) {
    process.chdir(prevCwd); // revert process current dir
  }
};

describe.each(cases)("Downloading %s", (version) => {
  beforeAll(async () => {
    await fs.remove("./out");
    await fs.ensureDir("./out");
    await runCli({ version: version, dir: version, skip: true });
  });
  afterAll(async () => {
    await fs.remove(outputFolder(version));
  });

  if (version && version !== "-r=latest") {
    // if we will fetch all versions from npm registry we will be able to check latest
    // for now we will skip this test for 'latest' version
    test(`Version is correct: ${version}`, async () => {
      const cssContent = await fs.readFile(
        `./out/${version}/css/main.css`,
        "utf-8"
      );
      let versionClear = version.replace(/(-r=|--release=|v)/gi, "");
      if (versionClear === "7.0.0") {
        versionClear = "6.1.0";
      }
      if (versionClear === "0.0.1") {
        versionClear = "5.3.0";
      }
      expect(
        cssContent.indexOf(`HTML5 Boilerplate v${versionClear}`) > -1
      ).toBe(true);
    });
  }

  test("Target directory exists", async () => {
    const outDirExists = await fs.exists(outputFolder(version));
    expect(outDirExists).toBe(true);
  });

  test("Target directory have files", async () => {
    const dirContents = await fs.readdir(outputFolder(version));
    expect(dirContents.length).toBeGreaterThanOrEqual(7);
  });

  test("Target directory contains specific files", async () => {
    const dirContents = await fs.readdir(outputFolder(version));
    const check = [
      "index.html",
      "robots.txt",
      "tile.png",
      "css",
      "js",
      "img",
      ".gitignore",
    ].filter((v) => dirContents.indexOf(v) === -1);
    expect(check.length === 0).toBe(true);
  });

  test("Target directory contains img/.gitignore", async () => {
    const imgGitIgnore = await fs.exists(
      outputFolder(version) + "/img/.gitignore"
    );
    expect(imgGitIgnore).toBe(true);
  });

  test("Temp directory removed", async () => {
    const tempDirExists = await fs.exists(tempDir);
    expect(tempDirExists).toBe(false);
  });
});

describe("Errors", () => {
  test("Wrong version 6..2.3", async () => {
    //maybe create test.each() for more errors scenarios
    const version = "-r=6..2.3";
    try {
      await runCli({
        version: version,
        dir: version,
        skip: true,
      });
    } catch (err) {
      expect(err).toBe("ETARGET");
    } finally {
      await fs.remove(outputFolder(version));
    }
  });
});

describe("Unexpected errors", () => {
  test("Unexpected error 6..2.3,7.2.3", async () => {
    //maybe create test.each() for more errors scenarios
    const version = "-r=6..2.3,7.2.3";
    try {
      await runCli({
        version: version,
        dir: version,
        skip: true,
      });
    } catch (err) {
      expect(err).not.toBe("ETARGET");
    } finally {
      await fs.remove(outputFolder(version));
    }
  });
});

describe("lang", () => {
  test("lang", async () => {
    const lang = "en-US";
    await runCli({
      lang: "en-US",
      dir: `lang_${lang}`,
    });
    const fileContent = await fs.readFile("./out/lang_en-US/index.html");
    expect(fileContent.indexOf(`lang="${lang}"`) > -1).toBe(true);
    await fs.remove(`./out/lang_${lang}`);
  });
});
