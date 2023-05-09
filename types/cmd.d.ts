export = CLI;
/**
 * Implement the command line interface.
 */
declare class CLI {
    defaultOutput: NodeJS.WriteStream & {
        fd: 1;
    };
    yargs: import("yargs").Argv<import("yargs").Omit<{}, "Q" | "html" | "i" | "output" | "s" | "C" | "backup" | "c" | "d" | "m" | "n" | "periodSpaces"> & import("yargs").InferredOptionTypes<{
        C: {
            alias: string;
            type: "boolean";
            default: any;
            defaultDescription: string;
            desc: string;
        };
        i: {
            alias: string;
            type: "array";
            desc: string;
        };
        output: {
            alias: string;
            type: "string";
            desc: string;
            defaultDescription: string;
            requiresArg: true;
            default: string;
            normalize: true;
        };
        backup: {
            alias: string;
            type: "string";
            requiresArg: true;
            coerce: (v: any) => string;
            desc: string;
        };
        c: {
            alias: string;
            config: true;
            default: string;
            desc: string;
            type: "string";
            requiresArg: true;
            normalize: true;
        };
        d: {
            alias: string;
            type: "boolean";
            default: boolean;
            desc: string;
        };
        m: {
            alias: string;
            type: "number";
            default: number;
            desc: string;
            requiresArg: true;
        };
        s: {
            alias: string;
            type: "number";
            default: number;
            desc: string;
            requiresArg: true;
        };
        n: {
            alias: string;
            type: "boolean";
            default: boolean;
            desc: string;
        };
        html: {
            type: "boolean";
            default: any;
            defaultDescription: string;
            desc: string;
        };
        periodSpaces: {
            type: "number";
            default: number;
            desc: string;
            requiresArg: true;
        };
        Q: {
            alias: string;
            type: "boolean";
            default: boolean;
            desc: string;
        };
    }>>;
    /**
     * Implement the command-line interface.
     *
     * @param {string[]} [args] Command-line arguments.
     */
    cmd(args?: string[]): Promise<void>;
}
