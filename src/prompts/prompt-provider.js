// @ts-check

/**
 * @typedef {Object} PromptOption
 * @property {string} label Display text for the option
 * @property {string} value Value to return if this option is selected
 */

/**
 * @typedef {Object} PromptProvider
 * @property {(message: string) => Promise<boolean>} confirm Ask a yes/no question
 * @property {(message: string) => Promise<string>} text Prompt for free-form text input
 * @property {(message: string, options: PromptOption[]) => Promise<string>} select Choose from a list of options
 */

export {};
