// @ts-check

/**
 * @typedef {import('./prompt-provider.js').PromptOption} PromptOption
 * @typedef {import('./prompt-provider.js').PromptProvider} PromptProvider
 */

/**
 * Custom error class for unscripted test prompts.
 * Thrown when a test attempts to prompt for an answer that was not scripted.
 */
export class UnscriptedPromptError extends Error {
  /**
   * @param {string} promptType The type of prompt that was attempted
   * @param {string} promptMessage The message shown in the unscripted prompt
   * @param {string[]} availableKeys The keys that have been scripted
   */
  constructor(promptType, promptMessage, availableKeys) {
    super(
      `Unscripted test prompt: [${promptType}] ${promptMessage}\n` +
        `Available scripted prompts: ${availableKeys.join(", ") || "(none)"}`,
    );
    this.name = "UnscriptedPromptError";
    this.code = "ERR_UNSCRIPTED_PROMPT";
    /** @type {string} */
    this.promptType = promptType;
    /** @type {string} */
    this.promptMessage = promptMessage;
    /** @type {string[]} */
    this.availableKeys = availableKeys;
  }
}

/**
 * Deterministic test prompt provider.
 * Accepts a scripted map of answers and throws an error if an unscripted prompt is requested.
 * Suitable for unit and integration tests where all prompts must be deterministic.
 *
 * @implements {PromptProvider}
 */
export class TestPrompts {
  /**
   * Map of prompt keys to their scripted answers.
   * @type {Map<string, string | boolean>}
   */
  #scripts;

  /**
   * Initialize the test prompt provider with a scripted answer map.
   *
   * @param {Record<string, string | boolean>} scriptedAnswers Map of prompt keys to values
   * @example
   * new TestPrompts({
   *   'override': true,
   *   'langChoice': 'English (en)',
   *   'removeJquery': false
   * })
   */
  constructor(scriptedAnswers = {}) {
    this.#scripts = new Map(Object.entries(scriptedAnswers));
  }

  /**
   * Set or update a scripted answer for a prompt key.
   *
   * @param {string} key Unique identifier for this prompt
   * @param {string | boolean} value The scripted response
   */
  setScript(key, value) {
    this.#scripts.set(key, value);
  }

  /**
   * Ask a yes/no confirmation question.
   *
   * @param {string} message The confirmation prompt text
   * @throws {UnscriptedPromptError} If no script for "confirm" exists
   * @returns {Promise<boolean>} The scripted boolean response
   */
  async confirm(message) {
    const key = "confirm";
    if (!this.#scripts.has(key)) {
      throw new UnscriptedPromptError(
        "confirm",
        message,
        Array.from(this.#scripts.keys()),
      );
    }
    const value = this.#scripts.get(key);
    if (typeof value !== "boolean") {
      throw new TypeError(
        `Expected boolean for confirm, got ${typeof value}: ${String(value)}`,
      );
    }
    return value;
  }

  /**
   * Prompt for free-form text input.
   *
   * @param {string} message The input prompt text
   * @throws {UnscriptedPromptError} If no script for "text" exists
   * @returns {Promise<string>} The scripted text response
   */
  async text(message) {
    const key = "text";
    if (!this.#scripts.has(key)) {
      throw new UnscriptedPromptError(
        "text",
        message,
        Array.from(this.#scripts.keys()),
      );
    }
    const value = this.#scripts.get(key);
    if (typeof value !== "string") {
      throw new TypeError(
        `Expected string for text, got ${typeof value}: ${String(value)}`,
      );
    }
    return value;
  }

  /**
   * Prompt user to select from a list of options.
   *
   * @param {string} message The selection prompt text
   * @param {PromptOption[]} options Available options (validated in test)
   * @throws {UnscriptedPromptError} If no script for "select" exists
   * @returns {Promise<string>} The scripted selection value
   */
  async select(message, options) {
    const key = "select";
    if (!this.#scripts.has(key)) {
      throw new UnscriptedPromptError(
        "select",
        message,
        Array.from(this.#scripts.keys()),
      );
    }
    const value = this.#scripts.get(key);
    if (typeof value !== "string") {
      throw new TypeError(
        `Expected string for select, got ${typeof value}: ${String(value)}`,
      );
    }
    // Optionally validate that the value is in the options list
    const validValue = options.find((opt) => opt.value === value);
    if (!validValue) {
      throw new RangeError(
        `Scripted select value "${value}" is not in available options: ${options.map((opt) => opt.value).join(", ")}`,
      );
    }
    return value;
  }
}
