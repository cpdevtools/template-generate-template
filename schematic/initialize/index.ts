import { apply, chain, mergeWith, renameTemplateFiles, Rule, SchematicContext, strings, template, Tree, url } from "@angular-devkit/schematics";
import Path from 'path/posix';
import { readJsonFile } from '@cpdevtools/lib-node-utilities';

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
            const ext = Path.extname(options.dataFile);
            switch (ext) {
                case '.json':
                    data = await readJsonFile(options.dataFile);
                    break;

            }
        }

        const tplOpts = {
            ...data,
            dot: ".",
            strings: {
                ...strings,
                lower: (str: string) => str.toLowerCase(),
                upper: (str: string) => str.toUpperCase(),
            },
        };

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