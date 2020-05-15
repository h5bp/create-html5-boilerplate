const fs = require("fs-extra");
const cli = require("../cli");
const os = require("os");
const packageName = "html5-boilerplate";
const tempDir = os.tmpdir() + `/${packageName}-staging`;
const defaultDir = "./out/default_dir";

// TODO: fetch all versions:
// const { packument } = require('pacote');
// const versions = await packument(packageName);
// cases = ['', 'latest', '-r=7.3.0', ...Object.keys(versions)];
const all_versions = [
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
  "-r=7.2.0",
  "-r=v7.2.0",
  "-r=v7.2",
  "--release=7.3.0",
  ...all_versions.map((v) => "-r=" + v),
];
const versionFolder = (version = null) =>
  version ? `./out/${version}` : defaultDir;

const runCli = async (version = null) => {
  let prevCwd;
  if (version) {
    process.argv.push(version);
    process.argv.push(versionFolder(version));
  } else {
    await fs.ensureDir(defaultDir);
    prevCwd = process.cwd();
    process.chdir(defaultDir);
  }
  await cli();
  if (version) {
    process.argv = process.argv.filter(
      (v) => v !== version && v !== versionFolder(version)
    ); //revert process args
  } else {
    process.chdir(prevCwd);//revert process current dir
  }
};
describe.each(cases)("Downloading %s", (version) => {
  beforeAll(async () => {
    await runCli(version);
  });
  afterAll(async () => {
    await fs.remove(versionFolder(version));
  });

  if (version && version != "-r=latest") {
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
    const outDirExists = await fs.exists(versionFolder(version));
    expect(outDirExists).toBe(true);
  });

  test("Target directory have files", async () => {
    const dirContents = await fs.readdir(versionFolder(version));
    expect(dirContents.length).toBeGreaterThanOrEqual(7);
  });

  test("Target directory contains specific files", async () => {
    const dirContents = await fs.readdir(versionFolder(version));
    const check = [
      "index.html",
      "robots.txt",
      "tile.png",
      "css",
      "js",
      "img",
    ].filter((v) => dirContents.indexOf(v) === -1);
    expect(check.length === 0).toBe(true);
  });

  test("Temp directory removed", async () => {
    const tempDirExists = await fs.exists(tempDir);
    expect(tempDirExists).toBe(false);
  });
});

describe("Errors", () => {
  test("Wrong version 6..2.3", async () => {//maybe create test.each() for more errors scenarios
    const mockExit = jest.spyOn(process, "exit").mockImplementation(() => {});
    const version = "-r=6..2.3";

    await runCli(version);

    await fs.remove(versionFolder(version));
    expect(mockExit).toHaveBeenCalledWith(1);
    mockExit.mockRestore();
  });
});
