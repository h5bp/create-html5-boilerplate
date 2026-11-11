#!/usr/bin/env node

if (Number(process.versions.node.split(".")[0]) < 20) {
  console.error("Node.js 20 or higher is required.");
  process.exit(1);
}

import("./lib/cli.js").then(({ default: cli }) =>
  cli(process.argv.slice(2)).catch(console.error),
);
