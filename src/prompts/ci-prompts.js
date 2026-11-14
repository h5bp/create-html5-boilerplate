// @ts-check

/**
 * @typedef {import('./prompt-provider.js').PromptOption} PromptOption
 * @typedef {import('./prompt-provider.js').PromptProvider} PromptProvider
 */

/**
 * Custom error class for non-interactive prompt failures.
 * Thrown when a prompt is requested in a CI environment without a safe default.
 */
export class NonInteractivePromptError extends Error {
  /**
   * @param {string} promptType The type of prompt that was attempted
   * @param {string} promptMessage The message shown in the failed prompt
   */
  constructor(promptType, promptMessage) {
    super(
      `Non-interactive mode: cannot prompt user. [${promptType}] ${promptMessage}`,
    );
    this.name = "NonInteractivePromptError";
    this.code = "ERR_NON_INTERACTIVE_PROMPT";
    /** @type {string} */
    this.promptType = promptType;
    /** @type {string} */
    this.promptMessage = promptMessage;
  }
}

/**
 * CI/non-interactive prompt provider.
 * Never reads from stdin; always resolves safe defaults or throws a typed error.
 * Suitable for CI/CD pipelines where user interaction is impossible.
 *
 * Safe defaults:
 * - confirm: false (fail-closed; do not proceed without explicit confirmation)
 * - text: throws (no safe default for arbitrary text input)
 * - select: throws (no safe default for selection; user must provide --flags)
 *
 * @implements {PromptProvider}
 */
export class CiPrompts {
  /**
   * Ask a yes/no confirmation question.
   * Always returns false (fail-closed behavior).
   * Caller should check for this and proceed cautiously.
   *
   * @param {string} message The confirmation prompt text (unused in non-interactive mode)
   * @returns {Promise<boolean>} Always false (safe default for CI)
   */
  async confirm(message) {
    void message; // Suppress unused variable warning; part of interface contract
    // Fail-closed: default to 'no' in non-interactive environments
    return false;
  }

  /**
   * Prompt for free-form text input.
   * Non-interactive mode has no safe default for arbitrary text.
   * This method always throws a NonInteractivePromptError.
   *
   * @param {string} message The input prompt text
   * @throws {NonInteractivePromptError} Always thrown in non-interactive mode
   * @returns {Promise<never>}
   */
  async text(message) {
    throw new NonInteractivePromptError("text", message);
  }

  /**
   * Prompt user to select from a list of options.
   * Non-interactive mode has no safe default for selection.
   * This method always throws a NonInteractivePromptError.
   *
   * @param {string} message The selection prompt text
   * @param {PromptOption[]} options Available options (unused; for interface conformance)
   * @throws {NonInteractivePromptError} Always thrown in non-interactive mode
   * @returns {Promise<never>}
   */
  async select(message, options) {
    void options; // Suppress unused variable warning; part of interface contract
    throw new NonInteractivePromptError("select", message);
  }
}
