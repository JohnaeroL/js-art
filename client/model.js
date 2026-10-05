/* Edit list with undo/redo. An edit is {selector, prop, value, ui}; ui keeps the control position (k, px, color).
   History is snapshot-based: the UI calls begin() once per gesture, so a slider drag is one undo step. */

const LIMIT = 100;
const keyOf = (selector, prop) => selector + '\u0000' + prop;

export class Model {
  #edits = new Map();
  #undo = [];
  #redo = [];

  constructor(onChange) { this.onChange = onChange; }

  #snapshot() { return new Map([...this.#edits].map(([k, e]) => [k, { ...e }])); }
  #emit() { this.onChange(this.list()); }

  /* weak = written without !important (see css-writer) */
  set(selector, prop, value, ui, weak = false) {
    const k = keyOf(selector, prop);
    if (value == null) { this.#edits.delete(k); this.#emit(); return; }
    const e = { selector, prop, value, ui };
    if (weak) e.weak = true;
    /* replacing keeps the insertion order of an existing key */
    this.#edits.set(k, e);
    this.#emit();
  }

  get(selector, prop) { return this.#edits.get(keyOf(selector, prop)); }
  list() { return [...this.#edits.values()].map(e => ({ ...e })); }

  begin() {
    this.#undo.push(this.#snapshot());
    if (this.#undo.length > LIMIT) this.#undo.shift();
    this.#redo = [];
  }

  get canUndo() { return this.#undo.length > 0; }
  get canRedo() { return this.#redo.length > 0; }

  undo() {
    if (!this.#undo.length) return false;
    this.#redo.push(this.#snapshot());
    this.#edits = this.#undo.pop();
    this.#emit();
    return true;
  }

  redo() {
    if (!this.#redo.length) return false;
    this.#undo.push(this.#snapshot());
    this.#edits = this.#redo.pop();
    this.#emit();
    return true;
  }

  reset(filter = () => true) {
    this.begin();
    for (const [k, e] of this.#edits) if (filter(e)) this.#edits.delete(k);
    this.#emit();
  }

  load(edits) {
    this.#edits = new Map(edits.map(e => [keyOf(e.selector, e.prop), { ...e }]));
    this.#emit();
  }
}
