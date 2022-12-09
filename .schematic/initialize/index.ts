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
  templatePath: string;
}

function generateTemplate(options: Options) {
  return async () => {
    let templatePath = Path.normalize(options.templatePath);
    if (!templatePath.startsWith("/")) {
      templatePath = Path.join(process.cwd(), templatePath);
    }

    let data = (await readDataFile(Path.join(templatePath, "options"))) ?? {};
    let versions = (await readDataFile(Path.join(templatePath, "versions"))) ?? {};

    const tplOpts: any = {
      ...data,
      dot: ".",
      strings: {
        ...strings,
        lower: (str: string) => str.toLowerCase(),
        upper: (str: string) => str.toUpperCase(),
        json: (obj: any) => JSON.stringify(obj),
        pjson: (obj: any) => JSON.stringify(obj, undefined, 2),
      },
      versions,
    };

    console.log(tplOpts);

    const packagePath = Path.join(process.cwd(), "package.json");
    const pkg = existsSync(packagePath) ? ((await readJsonFile(packagePath)) as PackageJson) : null;
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

    return mergeWith(apply(url(Path.join(templatePath, "files")), [template(tplOpts), renameTemplateFiles()]));
  };
}

async function readDataFile<T = unknown>(dataPath: string) {
  const filePath = [`${dataPath}.js`, `${dataPath}.yaml`, `${dataPath}.yml`, `${dataPath}.json`, `${dataPath}`].find((f) => existsSync(f));

  if (filePath) {
    const ext = Path.extname(filePath).toLowerCase();
    switch (ext) {
      case ".js":
        return (await require(filePath).default) as T;
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

  rules.push(cleanGenerator(options));
  rules.push(mergeWith(apply(empty(), [generateTemplate(options)]), MergeStrategy.Overwrite));
  return chain(rules);
}

function cleanGenerator(_: Options) {
  return async (tree: Tree, _: SchematicContext) => {
    try {
      tree.delete(".template");
    } catch {}
    try {
      tree.delete("pnpm-lock.yaml");
    } catch {}
  };
}
