export = Wrapper;
/**
 * Abstract base class for node Wrapper.
 * A node Wrapper subclass has-a node, and carries a set of analyses about
 * the node.  Don't call the constructor directly, but call the static
 * create() funciton, which acts as a factory.
 */
declare class Wrapper {
    /**
     * Factory method to create the right Wrapper based on the given node.
     *
     * @param {Dentin} dentin Configuration.
     * @param {xmljs.Node} [node=null] Wrap the given node.
     * @param {Wrapper} [parentWrapper=null] The parent of this node, null for
     *   the top-level.
     * @returns {Wrapper} A new Wrapper wrapping node.
     * @throws {Error} Unknown node.
     */
    static create(dentin: Dentin, node?: xmljs.Node, parentWrapper?: Wrapper): Wrapper;
    /**
     * Create a wrapper around a node.
     *
     * @param {Dentin} dentin Configuration.
     * @param {xmljs.Node} [node=null] Wrap the given node.
     * @param {Wrapper} [parentWrapper=null] The parent of this node, null for
     *   the top-level.
     */
    constructor(dentin: Dentin, node?: xmljs.Node, parentWrapper?: Wrapper);
    /**
     * Does the node have a parent that is mixed?
     *
     * @returns {boolean} The parent is mixed.
     */
    parentMixed(): boolean;
    /**
     * Abstract.  Print the node and return information about it.
     *
     * @param {number} [indent=0] How many tab stops to indent.
     * @param {state} [state=null] The current print state.  New one created
     *   if null.
     * @returns {State} Final state.
     */
    print(indent?: number, state?: any): State;
}
import State = require("./state");
