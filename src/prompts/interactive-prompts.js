// @ts-check

/**
 * @typedef {import('./prompt-provider.js').PromptOption} PromptOption
 * @typedef {import('./prompt-provider.js').PromptProvider} PromptProvider
 */

/**
 * Interactive prompt provider that wraps the inquirer terminal UI library.
 * Suitable for CLI environments with TTY access.
 * All prompts are bound to stdin/stdout of the parent process.
 *
 * @implements {PromptProvider}
 */
export class InteractivePrompts {
  /**
   * Inquirer instance with custom prompts registered.
   * @type {any}
   */
  #inquirer;

  /**
   * Initialize the interactive prompt provider.
   * Registers custom prompt types and binds the inquirer instance.
   *
   * @param {any} inquirer Inquirer instance (pre-configured with custom plugins)
   */
  constructor(inquirer) {
    this.#inquirer = inquirer;
  }

  /**
   * Ask a yes/no confirmation question.
   *
   * @param {string} message The confirmation prompt text
   * @returns {Promise<boolean>} User's yes/no response
   */
  async confirm(message) {
    /**
     * @type {{confirmed: boolean}}
     */
    const { confirmed } = await this.#inquirer.prompt({
      type: "confirm",
      name: "confirmed",
      message,
      default: true,
    });
    return confirmed;
  }

  /**
   * Prompt for free-form text input.
   *
   * @param {string} message The input prompt text
   * @returns {Promise<string>} User's text input
   */
  async text(message) {
    /**
     * @type {{input: string}}
     */
    const { input } = await this.#inquirer.prompt({
      type: "input",
      name: "input",
      message,
    });
    return input;
  }

  /**
   * Prompt user to select from a list of options.
   * Uses autocomplete search for large option lists.
   *
   * @param {string} message The selection prompt text
   * @param {PromptOption[]} options Available options to select from
   * @returns {Promise<string>} The value of the selected option
   */
  async select(message, options) {
    /**
     * @type {{selected: string}}
     */
    const { selected } = await this.#inquirer.prompt({
      type: "autocomplete",
      name: "selected",
      message,
      source: async (
        /** @type {Record<string, unknown>} */ answers,
        input = "",
      ) => {
        const { default: fuzzy } = await import("fuzzy");
        const optionLabels = options.map((opt) => opt.label);
        return fuzzy
          .filter(input, optionLabels)
          .map(({ original }) => original);
      },
      // Map labels back to values for return
      filter: (/** @type {string} */ selected) => {
        const option = options.find((opt) => opt.label === selected);
        return option ? option.value : selected;
      },
    });
    return selected;
  }
}
