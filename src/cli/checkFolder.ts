import fs from "fs-extra";
import inquirer from "inquirer";

export async function checkFolder(
  targetDir: string,
  argv: any,
): Promise<boolean> {
  const folderExists = await fs.pathExists(targetDir);
  if (!folderExists || argv.yes === true) {
    return true;
  }
  const folderFiles = await fs.readdir(targetDir);
  if (folderFiles.length !== -1) {
    const { override } = await inquirer.prompt({
      type: "confirm",
      name: "override",
      message: `${targetDir} is not an empty folder, proceed?`,
      default: true,
    });
    return override;
  }
  return true;
}
