import os from "os";
import pacote from "pacote";
import glob from "fast-glob";
import fs from "fs-extra";

export async function generate({
  destination,
  version = "latest",
  lang,
  removeJquery,
  skipConfiguration = false,
  onCopied,
  getConfiguration,
}) {
  const tempDir = `${os.tmpdir()}/html5-boilerplate-staging`;
  await fs.ensureDir(tempDir);
  try {
    const { from: nameWithVersion } = await pacote.extract(
      `html5-boilerplate@${version}`,
      tempDir,
      {},
    );
    await fs.copy(`${tempDir}/dist`, destination);
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
        const indexFile = `${destination}/index.html`;
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
        await fs.writeFile(indexFile, resultHTML);
      }
    }
    return { destination, nameWithVersion };
  } finally {
    await fs.remove(tempDir);
  }
}
