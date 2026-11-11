// @ts-check
import * as fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

/**
 * @param {string} target
 * @returns {Promise<boolean>}
 */
async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return false;
    throw error;
  }
}

/**
 * @param {string[]} [argv]
 * @returns {Promise<void>}
 */
export async function runCli(argv = process.argv) {
  if (Number(process.versions.node.split(".")[0]) < 20) {
    console.error("Node.js 20 or higher is required.");
    process.exitCode = 1;
    return;
  }

  let parsed;
  try {
    let afterTerminator = false;
    const args = argv.slice(2).flatMap((arg) => {
      if (arg === "--") afterTerminator = true;
      // The old parser treated explicit --yes values as non-boolean strings.
      if (!afterTerminator && /^(--yes|-y)=/.test(arg)) return ["--no-yes"];
      const shortRelease = !afterTerminator && /^-([a-zA-Z]*)r=(.*)$/.exec(arg);
      if (!shortRelease) return [arg];
      const [, precedingFlags, value] = shortRelease;
      return [
        ...(precedingFlags ? [`-${precedingFlags}`] : []),
        `--release=${value}`,
      ];
    });
    parsed = parseArgs({
      args,
      allowPositionals: true,
      strict: true,
      tokens: true,
      options: {
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
        release: { type: "string", short: "r" },
        yes: { type: "boolean", short: "y" },
        "no-yes": { type: "boolean" },
        lang: { type: "string" },
      },
    });
  } catch (error) {
    if (
      !(error instanceof TypeError) ||
      !("code" in error) ||
      typeof error.code !== "string" ||
      !error.code.startsWith("ERR_PARSE_ARGS_")
    ) {
      throw error;
    }
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const { values: options, positionals, tokens } = parsed;
  const yesToken = tokens
    .slice()
    .reverse()
    .find(
      (token) =>
        token.kind === "option" &&
        (token.name === "yes" || token.name === "no-yes"),
    );
  const yes = yesToken?.name === "yes";

  if (options.help) {
    console.log(`Usage: create-html5-boilerplate [target-directory] [options]

Options:
  -h, --help             Show help
  -v, --version          Show version
  -r, --release <value>  HTML5 Boilerplate release (default: latest)
  -y, --yes              Skip prompts
      --lang <value>     Set the HTML language`);
    return;
  }

  if (options.version) {
    try {
      /** @type {{version: string}} */
      const packageJson = JSON.parse(
        await fs.readFile(new URL("../package.json", import.meta.url), "utf8"),
      );
      console.log(packageJson.version);
    } catch (error) {
      console.error(error);
      process.exitCode = 1;
    }
    return;
  }

  try {
    const [
      { default: chalk },
      { default: inquirer },
      { default: fuzzy },
      { default: ora },
      { default: elapsed },
      { compareVersions },
      { default: inquirerAutocompletePrompt },
      { generate },
    ] = await Promise.all([
      import("chalk"),
      import("inquirer"),
      import("fuzzy"),
      import("ora"),
      import("elapsed-time-logger"),
      import("compare-versions"),
      import("inquirer-autocomplete-prompt"),
      import("./generator.js"),
    ]);

    inquirer.registerPrompt("autocomplete", inquirerAutocompletePrompt);
    const timer = elapsed.start();
    const version = options.release || "latest";
    const destination = path.resolve(process.cwd(), positionals[0] || "./");

    if ((await pathExists(destination)) && !yes) {
      const folderFiles = await fs.readdir(destination);
      if (folderFiles.length !== -1) {
        /** @type {{override: boolean}} */
        const { override } = await inquirer.prompt({
          type: "confirm",
          name: "override",
          message: `${destination} is not an empty folder, proceed?`,
          default: true,
        });
        if (!override) {
          console.log(chalk.red("Aborted"));
          return;
        }
      }
    }

    const spinner = ora(
      `Downloading html5-boilerplate version '${version}' to ${destination}`,
    ).start();
    let timerDownloaded;
    try {
      const result = await generate({
        destination,
        version,
        skipConfiguration: yes,
        onCopied: () => {
          timerDownloaded = timer.get();
          console.log(destination);
        },
        getConfiguration: async () => {
          /** @type {{title: string, value: string}[]} */
          const langsList = JSON.parse(
            await fs.readFile(
              new URL("../lib/countries.json", import.meta.url),
              "utf8",
            ),
          );
          /** @type {Record<string, string>} */
          const langListMap = {};
          /** @type {string[]} */
          const langListOut = [];
          if (!options.lang) {
            langsList.forEach(({ title, value }) => {
              const text = `${title} (${value})`;
              langListMap[text] = value;
              langListOut.push(text);
            });
            langListOut.splice(1, 0, "Enter custom");
          }
          spinner.stop();
          /** @type {{langChoice?: string, customLang?: string, removeJquery?: boolean}} */
          const { langChoice, customLang, removeJquery } =
            await inquirer.prompt([
              {
                type: "autocomplete",
                name: "langChoice",
                message: "Select language",
                when: !options.lang,
                source: async (
                  /** @type {Record<string, unknown>} */ answers,
                  input = "",
                ) =>
                  fuzzy
                    .filter(input, langListOut)
                    .map(({ original }) => original),
              },
              {
                type: "input",
                name: "customLang",
                message: "Enter custom language code",
                when: (/** @type {{langChoice?: string}} */ { langChoice }) =>
                  !options.lang && langChoice === langListOut[1],
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
          return {
            lang:
              options.lang ||
              (langChoice && langListMap[langChoice]) ||
              customLang ||
              "",
            removeJquery: removeJquery !== undefined ? removeJquery : false,
          };
        },
      });
      spinner.succeed(
        ` ${result.nameWithVersion} copied to ${destination} in ${timerDownloaded}. Have fun!`,
      );
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ETARGET" &&
        "wanted" in error &&
        typeof error.wanted === "string" &&
        "versions" in error &&
        Array.isArray(error.versions) &&
        error.versions.every((version) => typeof version === "string")
      ) {
        const message = chalk.red(
          `version '${error.wanted}' not found in npm registry\navailable versions:\n`,
        );
        spinner.fail(message + error.versions.reverse().join(" | "));
        process.exitCode = 1;
        return;
      }
      spinner.fail(`Could not generate project at ${destination}`);
      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code =
      error instanceof Error &&
      "code" in error &&
      typeof error.code === "string"
        ? `${error.code}: `
        : "";
    console.error(`Error: ${code}${message}`);
    process.exitCode = 1;
  }
}
