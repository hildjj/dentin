export = State;
declare class State {
    constructor(dentin: any, opts?: {});
    out(strOrState: any, length: any): State;
    right: any;
    newline(): State;
    firstLineLen: any;
    color(bits: any, ...bobs: any[]): State;
    newColor(bits: any, ...bobs: any[]): State;
    spacesString(n: any): State;
    spacesState(n: any): State;
    indent(stops: any): State;
    indentState(stops: any): State;
}
