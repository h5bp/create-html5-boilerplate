import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";

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
      !error.code?.startsWith("ERR_PARSE_ARGS_")
    ) {
      throw error;
    }
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const { values: options, positionals, tokens } = parsed;
  const yesToken = tokens.findLast(
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
      const packageJson = JSON.parse(
        await readFile(new URL("../package.json", import.meta.url), "utf8"),
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
      { default: path },
      { default: chalk },
      { default: inquirer },
      { default: fuzzy },
      { default: ora },
      { default: fs },
      { default: elapsed },
      { default: compareVersions },
      { default: inquirerAutocompletePrompt },
      { generate },
    ] = await Promise.all([
      import("path"),
      import("chalk"),
      import("inquirer"),
      import("fuzzy"),
      import("ora"),
      import("fs-extra"),
      import("elapsed-time-logger"),
      import("compare-versions"),
      import("inquirer-autocomplete-prompt"),
      import("./generator.js"),
    ]);

    inquirer.registerPrompt("autocomplete", inquirerAutocompletePrompt);
    const timer = elapsed.start();
    const version = options.release || "latest";
    const destination = path.resolve(process.cwd(), positionals[0] || "./");

    if ((await fs.pathExists(destination)) && !yes) {
      const folderFiles = await fs.readdir(destination);
      if (folderFiles.length !== -1) {
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
          const langsList = JSON.parse(
            await fs.readFile(
              new URL("../lib/countries.json", import.meta.url),
            ),
          );
          const langListMap = {};
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
          const { langChoice, customLang, removeJquery } =
            await inquirer.prompt([
              {
                type: "autocomplete",
                name: "langChoice",
                message: "Select language",
                when: !options.lang,
                source: async (answers, input = "") =>
                  fuzzy
                    .filter(input, langListOut)
                    .map(({ original }) => original),
              },
              {
                type: "input",
                name: "customLang",
                message: "Enter custom language code",
                when: ({ langChoice }) =>
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
            lang: options.lang || langListMap[langChoice] || customLang || "",
            removeJquery: removeJquery !== undefined ? removeJquery : false,
          };
        },
      });
      spinner.succeed(
        ` ${result.nameWithVersion} copied to ${destination} in ${timerDownloaded}. Have fun!`,
      );
    } catch (error) {
      if (error.code === "ETARGET") {
        const message = chalk.red(
          `version '${error.wanted}' not found in npm registry\navailable versions:\n`,
        );
        spinner.fail(message + error.versions.reverse().join(" | "));
        throw error.code;
      }
      spinner.fail("✖ Unexpected error");
      throw new Error(error);
    }
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
