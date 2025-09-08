import os from "os";
import path from "path";
import yargsParser from "yargs-parser";
import chalk from "chalk";
import inquirer from "inquirer";
import ora from "ora";
import pacote from "pacote";
import fs from "fs-extra";
import elapsed from "elapsed-time-logger";
import inqurerAutocompletePrompt from "inquirer-autocomplete-prompt";
import { onLoad, type OnLoadArgs } from "./cli/onLoad.js";

const packageName = "html5-boilerplate";
const tempDir = `${os.tmpdir()}/${packageName}-staging`;

inquirer.registerPrompt("autocomplete", inqurerAutocompletePrompt);

async function checkFolder(targetDir: string, argv: any): Promise<boolean> {
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
}

const extract = (a: string, b: string, c: object) => pacote.extract(a, b, c);

export default async function CreateHtml5BoilerplateCLI(
  argvs: string[],
): Promise<void> {
  const argv = yargsParser(argvs, {
    alias: { release: ["r"], yes: ["y"] },
  });
  const timer = elapsed.default.start(); //elapsed.create().start();
  const version = (argv.release || "latest").toString();
  const targetDir = path.resolve(
    process.cwd(),
    argv._[0] ? String(argv._[0]) : "./",
  );
  const override = await checkFolder(targetDir, argv);
  if (targetDir === "./") {
    console.log(targetDir);
    process.exit(0);
  }
  if (!override) {
    console.log(chalk.red("Aborted"));
    return;
  }
  const spinner = ora(
    `Downloading ${packageName} version '${version}' to ${targetDir}`,
  ).start();
  await fs.ensureDir(tempDir);
  try {
    const { from: nameWithVersion } = await extract(
      `${packageName}@${version}`,
      tempDir,
      {},
    );
    await fs.copy(`${tempDir}/dist`, targetDir);
    const timerDownloaded = timer.get();
    console.log(targetDir);
    await onLoad(targetDir, version, argv as OnLoadArgs, spinner);
    spinner.succeed(
      ` ${nameWithVersion} copied to ${targetDir} in ${timerDownloaded}. Have fun!`,
    );
  } catch (err: any) {
    if (err.code === "ETARGET") {
      const msg = chalk.red(
        `version '${err.wanted}' not found in npm registry\navailable versions:\n`,
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
