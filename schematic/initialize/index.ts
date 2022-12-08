import { apply, chain, mergeWith, renameTemplateFiles, Rule, SchematicContext, strings, template, Tree, url } from "@angular-devkit/schematics";
import Path from 'path/posix';
import { readJsonFile, readYamlFile } from '@cpdevtools/lib-node-utilities';
import { existsSync } from "fs";
import type { PackageJson } from 'type-fest'

export interface Options {
    sourcePath: string;
    clean: boolean;
    data: object;
    dataJson: string;
    dataFile: string;
}



function generateTemplate(options: Options) {
    return async () => {
        let sourcePath = Path.normalize(options.sourcePath);
        if (!sourcePath.startsWith('/')) {
            sourcePath = Path.join(process.cwd(), sourcePath);
        }

        let data = options.data ?? {};
        if (options.dataJson) {
            try { data = JSON.parse(options.dataJson) } catch { }
        } else if (options.dataFile) {
            let filePath = Path.normalize(options.dataFile);
            if (!filePath.startsWith('/')) {
                filePath = Path.join(process.cwd(), filePath);
            }

            const ext = Path.extname(filePath).toLowerCase();
            switch (ext) {
                case '.js':
                    data = require(filePath).default;
                    break;
                case '.json':
                    data = await readJsonFile(filePath);
                    break;
                case '.yml':
                case '.yaml':
                    data = await readYamlFile(filePath);
                    break;
            }
        }

        const tplOpts: any = {
            ...data,
            dot: ".",
            strings: {
                ...strings,
                lower: (str: string) => str.toLowerCase(),
                upper: (str: string) => str.toUpperCase(),
            },
        };

        const packagePath = Path.join(process.cwd(), 'package.json');
        const pkg = existsSync(packagePath) ? (await readJsonFile(packagePath) as PackageJson) : null;
        if (pkg) {
            tplOpts.package = pkg;
        }

        console.log(tplOpts);

        return mergeWith(
            apply(url(sourcePath), [
                template(tplOpts),
                renameTemplateFiles()
            ])
        )
    };

}

function cleanDest(_: Options) {
    return async (tree: Tree, _: SchematicContext) => {
        const dir = tree.getDir('.');
        dir.subdirs.forEach(d => d === '.git' || tree.delete(d));
        dir.subfiles.forEach(d => tree.delete(d));
    };
}

function header(options: Options) {
    return async (_: Tree, context: SchematicContext) => {
        context.logger.info('Initializing...');
        console.info('options:', options);
    };
}

export function initialize(options: Options): Rule {
    const rules: (Rule)[] = [header(options)];

    if (options.clean) {
        rules.push(cleanDest(options));
    }

    rules.push(generateTemplate(options));
    return chain(rules);
}