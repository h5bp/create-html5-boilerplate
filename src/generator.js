import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import glob from "fast-glob";
import { downloadRelease } from "./download.js";

export async function generate({
  destination,
  version = "latest",
  lang,
  removeJquery,
  skipConfiguration = false,
  onCopied,
  getConfiguration,
}) {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "html5-boilerplate-staging-"),
  );
  try {
    const extractedDir = path.join(tempDir, "package");
    await fs.mkdir(extractedDir);
    const nameWithVersion = await downloadRelease(
      version,
      extractedDir,
      path.join(tempDir, "archive.tgz"),
    );
    await fs.cp(path.join(extractedDir, "dist"), destination, {
      recursive: true,
      force: true,
      verbatimSymlinks: true,
    });
    if (onCopied) await onCopied({ destination, nameWithVersion });

    const npmIgnoreFiles = await glob(
      `${destination.replace(/\\/g, "/")}/**/.npmignore`,
    );
    await Promise.all(
      npmIgnoreFiles.map((fileName) =>
        fs.rename(fileName, fileName.replace(/\.npmignore$/, ".gitignore")),
      ),
    );

    if (!skipConfiguration) {
      const configuration = getConfiguration
        ? await getConfiguration()
        : { lang, removeJquery };
      if (configuration.lang !== undefined || configuration.removeJquery) {
        const indexFile = path.join(destination, "index.html");
        const sourceHTML = await fs.readFile(indexFile, "utf-8");
        let resultHTML = sourceHTML;
        if (configuration.lang !== undefined) {
          resultHTML = resultHTML.replace(
            /(<html.*lang=)"([^"]*)"/gi,
            `$1"${configuration.lang}"`,
          );
        }
        if (configuration.removeJquery) {
          resultHTML = resultHTML.replace(
            /(<script>window\.jQuery.*<\/script>|<script src=".*jquery.*<\/script>)/gi,
            "",
          );
        }
        await fs.writeFile(indexFile, resultHTML, "utf-8");
      }
    }
    return { destination, nameWithVersion };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}
