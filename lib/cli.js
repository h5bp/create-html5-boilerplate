"use strict";
const yargs_parser = require("yargs-parser");
const path = require("path");
const chalk = require("chalk");
const langsList = require("./countries.json");
const inquirer = require("inquirer");
const fuzzy = require("fuzzy");
const ora = require("ora");
const { extract } = require("pacote");
const glob = require("fast-glob");
const fs = require("fs-extra");
const os = require("os");
const packageName = "html5-boilerplate";
const tempDir = os.tmpdir() + `/${packageName}-staging`;
const elapsed = require("elapsed-time-logger");
const compareVersions = require("compare-versions");
let spinner;
inquirer.registerPrompt(
  "autocomplete",
  require("inquirer-autocomplete-prompt")
);
module.exports = async (argvs) => {
  const argv = yargs_parser(argvs, {
    alias: { release: ["r"], yes: ["y"] },
  });
  const timer = elapsed.start();
  const version = (argv["release"] || "latest").toString();
  const targetDir = path.resolve(argv["_"][0] || "./");
  const override = await checkFolder(targetDir, argv);
  if (!override) {
    console.log(chalk.red("Aborted"));
    return;
  }
  spinner = ora(
    `Downloading ${packageName} version '${version}' to ${targetDir}`
  ).start();
  await fs.ensureDir(tempDir);
  try {
    const { from: nameWithVersion } = await extract(
      packageName + "@" + version,
      tempDir,
      {}
    );
    await fs.copy(tempDir + "/dist", targetDir);
    const timerDownloaded = timer.get();
    await onLoad(targetDir, version, argv);
    spinner.succeed(
      ` ${nameWithVersion} copied to ${targetDir} in ${timerDownloaded}. Have fun!`
    );
    return;
  } catch (err) {
    if (err.code === "ETARGET") {
      const msg = chalk.red(
        `version '${err.wanted}' not found in npm registry\navailable versions:\n`
      );
      spinner.fail(msg + err.versions.reverse().join(" | "));
      throw err.code;
    }
    spinner.fail("✖ Unexpected error");
    throw new Error(err);
  } finally {
    await fs.remove(tempDir);
    process.exit();
  }
};

const checkFolder = async (targetDir, argv) => {
  const folderExists = await fs.pathExists(targetDir);
  if (!folderExists) {
    return true;
  }
  if (argv["yes"] === true) {
    return true;
  }
  const folderFiles = await fs.readdir(targetDir);
  if (folderFiles.length !== -1) {
    const { override } = await inquirer.prompt({
      type: "confirm",
      name: "override",
      message: `${targetDir} is not an empty folder, proceed?`,
      default: true,
    });
    return override;
  }
};

const onLoad = async (targetDir, version, argv) => {
  // see https://github.com/mrmlnc/fast-glob#how-to-write-patterns-on-windows
  const npmIgnoreFiles = await glob(
    `${targetDir.replace(/\\/g, "/")}/**/.npmignore`
  );
  for (const npmIgnore of npmIgnoreFiles) {
    await fs.rename(npmIgnore, npmIgnore.replace(/\.npmignore$/, ".gitignore"));
  }
  const skipPrompts = argv["yes"] === true;

  if (skipPrompts) {
    return;
  }
  const langListMap = {};
  const langListOut = [];
  /* istanbul ignore if */
  if (!argv.lang) {
    for (const { title, value } of langsList) {
      const text = `${title} (${value})`;
      langListMap[text] = value;
      langListOut.push(text);
    }
    langListOut.splice(1, 0, "Enter custom");
  }
  spinner.stop();
  const { langChoice, customLang, removeJquery } = await inquirer.prompt([
    {
      type: "autocomplete",
      name: "langChoice",
      message: "Select language",
      when: !argv.lang,
      source: async (answers, input = "") =>
        fuzzy.filter(input, langListOut).map(({ original }) => original),
    },
    {
      type: "input",
      name: "customLang",
      message: "Enter custom language code",
      when: ({ langChoice }) => !argv.lang && langChoice === langListOut[1],
    },
    {
      type: "confirm",
      name: "removeJquery",
      message: "Remove jQuery?",
      when: version !== "latest" && compareVersions(version, "8.0.0"),
      default: true,
    },
  ]);
  spinner.start();
  const lang = argv.lang || langListMap[langChoice] || customLang || "";
  const removeJqueryFlag = removeJquery !== undefined ? removeJquery : false;
  try {
    const indexFile = targetDir + "/index.html";
    const sourceHTML = await fs.readFile(indexFile, "utf-8");
    let resultHTML = sourceHTML.replace(
      /(<html.*lang=)\"([^"]*)\"/gi,
      `$1"${lang}"`
    );
    if (removeJqueryFlag) {
      resultHTML = resultHTML.replace(
        /(<script>window\.jQuery.*<\/script>|<script src=".*jquery.*<\/script>)/gi,
        ""
      );
    }
    await fs.writeFile(indexFile, resultHTML);
    return;
  } catch (err) {
    /* istanbul ignore next */
    throw new Error(err);
  }
};
