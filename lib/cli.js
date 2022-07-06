import yargsParser from "yargs-parser";
import path from "path";
import chalk from "chalk";
import inquirer from "inquirer";
import fuzzy from "fuzzy";
import ora from "ora";
import pacote from "pacote";
import glob from "fast-glob";
import fs from "fs-extra";
import os from "os";
import elapsed from "elapsed-time-logger";
import compareVersions from "compare-versions";
import inqurerAutocompletePrompt from "inquirer-autocomplete-prompt";

const extract = (a, b, c) => pacote.extract(a, b, c);

const packageName = "html5-boilerplate";
const tempDir = `${os.tmpdir()}/${packageName}-staging`;
const servers = {
  apache: "Apache",
  gae: "Google App Engine (GAE)",
  iis: "Internet Information Services (IIS)",
  lighttpd: "lighttpd",
  nginx: "Nginx",
  node: "Node.js",
};
let spinner;
inquirer.registerPrompt("autocomplete", inqurerAutocompletePrompt);

const checkFolder = async (targetDir, argv) => {
  const folderExists = await fs.pathExists(targetDir);
  if (!folderExists || argv.yes === true) {
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
  return true;
};

const onLoad = async (targetDir, version, argv) => {
  // see https://github.com/mrmlnc/fast-glob#how-to-write-patterns-on-windows
  const npmIgnoreFiles = await glob(
    `${targetDir.replace(/\\/g, "/")}/**/.npmignore`
  );
  await Promise.all(
    // eslint-disable-next-line arrow-body-style
    npmIgnoreFiles.map((fileName) => {
      return fs.rename(
        fileName,
        fileName.replace(/\.npmignore$/, ".gitignore")
      );
    })
  );
  const skipPrompts = argv.yes === true;

  if (skipPrompts) {
    return;
  }
  const langsList = JSON.parse(
    await fs.readFile(new URL("./countries.json", import.meta.url))
  );

  const langListMap = {};
  const langListOut = [];
  /* istanbul ignore if */
  if (!argv.lang) {
    langsList.forEach(({ title, value }) => {
      const text = `${title} (${value})`;
      langListMap[text] = value;
      langListOut.push(text);
    });
    langListOut.splice(1, 0, "Enter custom");
  }
  spinner.stop();
  const {
    langChoice,
    customLang,
    removeJquery,
    addServerConfigs,
    whichServerTech,
  } = await inquirer.prompt([
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
      // eslint-disable-next-line
      when: ({ langChoice }) => !argv.lang && langChoice === langListOut[1],
    },
    {
      type: "confirm",
      name: "removeJquery",
      message: "Remove jQuery?",
      when: version !== "latest" && compareVersions(version, "8.0.0"),
      default: true,
    },
    {
      type: "confirm",
      name: "addServerConfigs",
      message: "Add Server Configs?",
      when: version !== "latest" && compareVersions(version, "9.0.0"),
      default: false,
    },
    {
      type: "autocomplete",
      name: "whichServerTech",
      message: "Which Server Technology?",
      when: (answers) => answers.addServerConfigs,
      source: async (answers, input = "") =>
        fuzzy.filter(input, servers).map(({ original }) => original),
    },
  ]);
  spinner.start();
  const lang = argv.lang || langListMap[langChoice] || customLang || "";
  const removeJqueryFlag = removeJquery !== undefined ? removeJquery : false;
  if (addServerConfigs) {
    const server = servers[whichServerTech];
    console.log(`let's get ${server}`);
  }
  try {
    const indexFile = `${targetDir}/index.html`;
    const sourceHTML = await fs.readFile(indexFile, "utf-8");
    let resultHTML = sourceHTML.replace(
      /(<html.*lang=)"([^"]*)"/gi,
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

export default async function CreateHtml5BoilerplateCLI(argvs) {
  const argv = yargsParser(argvs, {
    alias: { release: ["r"], yes: ["y"] },
  });
  const timer = elapsed.start();
  const version = (argv.release || "latest").toString();
  const targetDir = path.resolve(process.cwd(), argv._[0] || "./");
  const override = await checkFolder(targetDir, argv);
  if (targetDir === "./") {
    console.log(targetDir);
    process.exit(0);
  }
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
      `${packageName}@${version}`,
      tempDir,
      {}
    );
    await fs.copy(`${tempDir}/dist`, targetDir);
    const timerDownloaded = timer.get();
    console.log(targetDir);
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
  }
}
