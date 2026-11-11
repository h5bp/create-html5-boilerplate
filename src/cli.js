export async function runCli(argv = process.argv) {
  if (Number(process.versions.node.split(".")[0]) < 20) {
    console.error("Node.js 20 or higher is required.");
    process.exitCode = 1;
    return;
  }

  try {
    const [
      { default: path },
      { default: yargsParser },
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
      import("yargs-parser"),
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
    const options = yargsParser(argv.slice(2), {
      alias: { release: ["r"], yes: ["y"] },
    });
    const timer = elapsed.start();
    const version = (options.release || "latest").toString();
    const destination = path.resolve(process.cwd(), options._[0] || "./");

    if ((await fs.pathExists(destination)) && options.yes !== true) {
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
        skipConfiguration: options.yes === true,
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
