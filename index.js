#!/usr/bin/env node
// @ts-check

const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor < 20) {
  console.error("Node.js 20 or higher is required.");
  process.exitCode = 1;
} else {
  import("./src/cli.js").then(({ runCli }) => runCli());
}
