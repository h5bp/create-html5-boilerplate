// @ts-check
import * as fs from "node:fs/promises";

/**
 * @typedef {import('../prompts/prompt-provider.js').PromptProvider} PromptProvider
 */

/**
 * @typedef {Object} CreateProjectOptions
 * @property {string} destination Target directory for project generation.
 * @property {string} [version="latest"] HTML5 Boilerplate release version.
 * @property {string} [lang] HTML language code.
 * @property {boolean} [removeJquery] Remove jQuery scripts from generated HTML.
 * @property {boolean} [skipConfiguration] Skip interactive configuration prompts.
 * @property {PromptProvider} [prompts] Prompt provider for interactive prompts.
 * @property {(result: {destination: string, nameWithVersion: string}) => void | Promise<void>} [onCopied] Callback after template files are copied.
 */

/**
 * Execute project creation by delegating to the generator service.
 * This command layer is responsible for orchestrating CLI options and service invocations.
 * @param {CreateProjectOptions} options
 * @returns {Promise<{destination: string, nameWithVersion: string}>}
 */
export async function createProjectCommand(options) {
  const { generate } = await import("../generator.js");

  const result = await generate({
    destination: options.destination,
    version: options.version,
    lang: options.lang,
    removeJquery: options.removeJquery,
    skipConfiguration: options.skipConfiguration,
    prompts: options.prompts,
    onCopied: options.onCopied,
  });

  return result;
}

/**
 * Determine if a directory exists and is non-empty.
 * @param {string} target
 * @returns {Promise<boolean>}
 */
export async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return false;
    throw error;
  }
}
