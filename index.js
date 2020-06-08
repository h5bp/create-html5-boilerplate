#!/usr/bin/env node
require("./lib/cli")(process.argv.slice(2)).catch(console.error);
