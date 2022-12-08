import { apply, chain, empty, MergeStrategy, mergeWith, move, renameTemplateFiles, Rule, SchematicContext, strings, template, Tree, url } from '@angular-devkit/schematics';



function generate<TOptions extends Record<string, any>>(tplPath: string, options: TOptions): Rule {
    return (tree: Tree, _context: SchematicContext) => {
        return mergeWith(
            apply(url(tplPath), [
                template({
                    ...strings,
                    lower: (s: string) => s.toLowerCase(),
                    dot: ".",
                    //    versions,
                    ...options
                }),
                renameTemplateFiles()
            ])
        );
    }
}


export function writeTemplateDirectoryRule(path:string, opts:any): Rule {
    return chain([
        mergeWith(
            apply(empty(), [
                generate(path, opts),
                move(opts.directory ?? '.generated'),
            ]),
            MergeStrategy.Overwrite
        ),
    ]);
}

