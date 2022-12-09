import {
  apply,
  chain,
  empty,
  MergeStrategy,
  mergeWith,
  renameTemplateFiles,
  Rule,
  SchematicContext,
  strings,
  template,
  Tree,
  url,
} from "@angular-devkit/schematics";
import Path from "path/posix";
import { readJsonFile, readYamlFile } from "@cpdevtools/lib-node-utilities";
import { existsSync } from "fs";
import type { PackageJson } from "type-fest";

export interface Options {
  sourcePath: string;
  clean: boolean;
  versionFile: string;
  dataFile: string;
}

function generateTemplate(options: Options) {
  return async () => {
    let sourcePath = Path.normalize(options.sourcePath);
    if (!sourcePath.startsWith("/")) {
      sourcePath = Path.join(process.cwd(), sourcePath);
    }

    let data = (await readDataFile(options.dataFile)) ?? {};
    let versions = (await readDataFile(options.versionFile)) ?? {};

    const tplOpts: any = {
      ...data,
      dot: ".",
      strings: {
        ...strings,
        lower: (str: string) => str.toLowerCase(),
        upper: (str: string) => str.toUpperCase(),
      },
      versions,
    };

    const packagePath = Path.join(process.cwd(), "package.json");
    const pkg = existsSync(packagePath)
      ? ((await readJsonFile(packagePath)) as PackageJson)
      : null;
    if (pkg) {
      tplOpts.package = pkg;

      const p = pkg.name?.split("/");
      const repoOwner = p?.shift()?.slice(1);
      const repoName = p?.join("/");
      tplOpts.repo = {
        owner: repoOwner,
        name: repoName,
      };
    }

    return mergeWith(
      apply(url(sourcePath), [template(tplOpts), renameTemplateFiles()])
    );
  };
}

async function readDataFile<T = unknown>(dataFile: string) {
  if (dataFile) {
    let filePath = Path.normalize(dataFile);
    if (!filePath.startsWith("/")) {
      filePath = Path.join(process.cwd(), filePath);
    }
    const ext = Path.extname(filePath).toLowerCase();
    switch (ext) {
      case ".js":
        return require(filePath).default as T;
      case ".json":
        return (await readJsonFile(filePath)) as T;
      case ".yml":
      case ".yaml":
        return (await readYamlFile(filePath)) as T;
    }
  }
  return undefined;
}

function cleanDest(_: Options) {
  return async (tree: Tree, _: SchematicContext) => {
    const dir = tree.getDir(".");
    dir.subdirs.forEach((d) => d === ".git" || tree.delete(d));
    dir.subfiles.forEach((d) => tree.delete(d));
  };
}

export function initialize(options: Options): Rule {
  const rules: Rule[] = [];
  if (options.clean) {
    rules.push(cleanDest(options));
  }
  rules.push(
    mergeWith(
      apply(empty(), [generateTemplate(options)]),
      MergeStrategy.Overwrite
    )
  );
  return chain(rules);
}