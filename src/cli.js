// @ts-check
import * as fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { createLogger } from "./logger.js";
import { createProjectCommand } from "./commands/create-project.js";

/**
 * @typedef {import('./prompts/prompt-provider.js').PromptProvider} PromptProvider
 */

/**
 * @param {unknown} error
 * @param {string} destination
 * @param {string} version
 * @returns {{message: string, context: import("./logger.js").DiagnosticContext}}
 */
function describeFailure(error, destination, version) {
  const reason = error instanceof Error ? error.message : String(error);
  const code =
    error instanceof Error && "code" in error && typeof error.code === "string"
      ? error.code
      : undefined;
  const errorPath =
    error instanceof Error && "path" in error && typeof error.path === "string"
      ? error.path
      : destination;

  if (
    code === "ETARGET" &&
    error instanceof Error &&
    "versions" in error &&
    Array.isArray(error.versions) &&
    error.versions.every((value) => typeof value === "string")
  ) {
    return {
      message: `Release version '${version}' not found in npm registry`,
      context: {
        version,
        reason,
        hint: "Choose an available version or use --release=latest.",
        availableVersions: [...error.versions].reverse().join(" | "),
        error,
      },
    };
  }
  if (code === "EACCES" || code === "EPERM" || code === "EROFS") {
    return {
      message: "Permission denied while generating the project",
      context: {
        path: errorPath,
        reason,
        hint: "Check permissions for the destination and temporary directory, or choose writable locations.",
        error,
      },
    };
  }
  if (
    code === "ENOTDIR" ||
    code === "EEXIST" ||
    code === "ERR_FS_CP_DIR_TO_NON_DIR" ||
    code === "ERR_FS_CP_NON_DIR_TO_DIR"
  ) {
    return {
      message: `Could not generate project at ${destination}`,
      context: {
        path: errorPath,
        reason: `${code}: ${reason}`,
        hint: "Choose a directory without conflicting files or move the conflicting path.",
        error,
      },
    };
  }
  if (
    reason.startsWith("Failed to fetch release metadata") ||
    reason.startsWith("Failed to download template archive")
  ) {
    return {
      message: "Template download failed",
      context: {
        version,
        reason,
        hint: "Check your internet connection, registry URL, and proxy settings.",
        error,
      },
    };
  }
  return {
    message: `Could not generate project at ${destination}`,
    context: { path: errorPath, version, reason, error },
  };
}

/**
 * @param {string} target
 * @returns {Promise<boolean>}
 */
async function pathExistsInCli(target) {
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
 * @param {PromptProvider} [prompts]
 * @returns {Promise<void>}
 */
export async function runCli(argv = process.argv, prompts) {
  const rawArgs = argv.slice(2);
  const terminator = rawArgs.indexOf("--");
  const logger = createLogger({
    debug: rawArgs
      .slice(0, terminator < 0 ? undefined : terminator)
      .includes("--debug"),
  });
  if (Number(process.versions.node.split(".")[0]) < 20) {
    logger.error("Node.js 20 or higher is required.", {
      hint: "Install a supported Node.js version and try again.",
    });
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
        "non-interactive": { type: "boolean" },
        debug: { type: "boolean" },
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
    logger.error("Error: Invalid command-line options", {
      hint: "Run with --help to see the available options.",
      error,
    });
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
    logger.info(`Usage: create-html5-boilerplate [target-directory] [options]

Options:
  -h, --help             Show help
  -v, --version          Show version
  -r, --release <value>  HTML5 Boilerplate release (default: latest)
  -y, --yes              Skip interactive prompts (use defaults or --flags)
      --non-interactive  Run in non-interactive mode (CI environments)
      --lang <value>     Set the HTML language
      --debug            Show detailed diagnostic information`);
    return;
  }

  if (options.version) {
    try {
      /** @type {{version: string}} */
      const packageJson = JSON.parse(
        await fs.readFile(new URL("../package.json", import.meta.url), "utf8"),
      );
      logger.info(packageJson.version);
    } catch (error) {
      logger.error("Could not read the CLI version", {
        hint: "Reinstall create-html5-boilerplate and try again.",
        error,
      });
      process.exitCode = 1;
    }
    return;
  }

  const version = options.release || "latest";
  const destination = path.resolve(process.cwd(), positionals[0] || "./");
  try {
    const [
      { default: chalk },
      { default: inquirer },
      { default: ora },
      { default: elapsed },
      { default: inquirerAutocompletePrompt },
    ] = await Promise.all([
      import("chalk"),
      import("inquirer"),
      import("ora"),
      import("elapsed-time-logger"),
      import("inquirer-autocomplete-prompt"),
    ]);

    inquirer.registerPrompt("autocomplete", inquirerAutocompletePrompt);

    // Initialize prompts provider if not injected (for CLI use)
    if (!prompts) {
      const isNonInteractive = yes || options["non-interactive"];
      if (isNonInteractive) {
        const { CiPrompts } = await import("./prompts/ci-prompts.js");
        prompts = new CiPrompts();
      } else {
        const { InteractivePrompts } =
          await import("./prompts/interactive-prompts.js");
        prompts = new InteractivePrompts(inquirer);
      }
    }

    const timer = elapsed.start();

    if (
      (await pathExistsInCli(destination)) &&
      !yes &&
      !options["non-interactive"]
    ) {
      const folderFiles = await fs.readdir(destination);
      if (folderFiles.length !== -1) {
        const override = await prompts.confirm(
          `${destination} is not an empty folder, proceed?`,
        );
        if (!override) {
          logger.info(chalk.red("Aborted"));
          return;
        }
      }
    }

    const spinner = ora(
      `Downloading html5-boilerplate version '${version}' to ${destination}`,
    ).start();
    let timerDownloaded;
    try {
      const result = await createProjectCommand({
        destination,
        version,
        lang: options.lang,
        skipConfiguration: yes || options["non-interactive"],
        prompts,
        onCopied: () => {
          timerDownloaded = timer.get();
          logger.info(destination);
        },
      });
      spinner.succeed(
        ` ${result.nameWithVersion} copied to ${destination} in ${timerDownloaded}. Have fun!`,
      );
    } catch (error) {
      spinner.stop();
      throw error;
    }
  } catch (error) {
    const diagnostic = describeFailure(error, destination, version);
    logger.error(diagnostic.message, diagnostic.context);
    process.exitCode = 1;
  }
}
