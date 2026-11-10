#!/usr/bin/env node
import cli from "./lib/cli.js";

cli(process.argv.slice(2)).catch(console.error);
