import glob from "fast-glob";
import fs from "fs-extra";
import inquirer from "inquirer";
import fuzzy from "fuzzy";
import { compareVersions } from "compare-versions";
import Spinner from "ora";

export interface OnLoadArgs {
  yes?: boolean;
  lang?: string;
}

export interface LangItem {
  title: string;
  value: string;
}

export async function onLoad(
  targetDir: string,
  version: string,
  argv: OnLoadArgs,
  spinner: any = Spinner,
): Promise<void> {
  // Fix Windows path for glob
  const npmIgnoreFiles = await glob(
    `${targetDir.replace(/\\/g, "/")}/**/.npmignore`,
  );
  await Promise.all(
    npmIgnoreFiles.map((fileName) =>
      fs.rename(fileName, fileName.replace(/\.npmignore$/, ".gitignore")),
    ),
  );
  const skipPrompts = argv.yes === true;
  if (skipPrompts) return;

  const langsList: LangItem[] = JSON.parse(
    await fs.readFile(new URL("../countries.json", import.meta.url), "utf-8"),
  );

  const langListMap: Record<string, string> = {};
  const langListOut: string[] = [];
  if (!argv.lang) {
    langsList.forEach(({ title, value }) => {
      const text = `${title} (${value})`;
      langListMap[text] = value;
      langListOut.push(text);
    });
    langListOut.splice(1, 0, "Enter custom");
  }
  spinner.stop();

  const { langChoice, customLang, removeJquery } = await inquirer.prompt([
    {
      type: "autocomplete",
      name: "langChoice",
      message: "Select language",
      when: !argv.lang,
      source: async (_answers: any, input = "") =>
        fuzzy.filter(input, langListOut).map(({ original }) => original),
    },
    {
      type: "input",
      name: "customLang",
      message: "Enter custom language code",
      when: ({ langChoice }: { langChoice: string }) =>
        !argv.lang && langChoice === langListOut[1],
    },
    {
      type: "confirm",
      name: "removeJquery",
      message: "Remove jQuery?",
      when: version !== "latest" && compareVersions(version, "8.0.0") < 0,
      default: true,
    },
  ]);
  spinner.start();

  const lang =
    argv.lang || langListMap[langChoice as string] || customLang || "";
  const removeJqueryFlag = removeJquery !== undefined ? removeJquery : false;

  try {
    const indexFile = `${targetDir}/index.html`;
    const sourceHTML = await fs.readFile(indexFile, "utf-8");
    let resultHTML = sourceHTML.replace(
      /(<html.*lang=)"([^"]*)"/gi,
      `$1"${lang}"`,
    );
    if (removeJqueryFlag) {
      resultHTML = resultHTML.replace(
        /(<script>window\.jQuery.*<\/script>|<script src=".*jquery.*<\/script>)/gi,
        "",
      );
    }
    await fs.writeFile(indexFile, resultHTML);
  } catch (err: any) {
    throw new Error(err);
  }
}
