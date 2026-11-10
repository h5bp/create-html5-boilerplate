import js from "@eslint/js";
import { importX } from "eslint-plugin-import-x";
import prettier from "eslint-plugin-prettier/recommended";
import globals from "globals";

export default [
  { ignores: ["coverage/**", "out/**", ".husky/**"] },
  js.configs.recommended,
  importX.flatConfigs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: { ecmaVersion: "latest", globals: globals.node },
    rules: { "preserve-caught-error": "off" },
  },
  prettier,
];
