#!/usr/bin/env node
// eslint-disable-next-line import/extensions
import cli from "./lib/cli.js";

cli(process.argv.slice(2)).catch(console.error);
