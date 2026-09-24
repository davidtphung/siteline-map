import assert from "node:assert/strict";
import test from "node:test";
import { JUMP_PLACES, renderJumpList } from "./jump-places.mjs";

function createDocument() {
  let seq = 0;
  function make(tag) {
    const node = {
      tag,
      id: "",
      className: "",
      type: "",
      textContent: "",
      dataset: {},
      attrs: {},
      children: [],
      ownerDocument: null,
      setAttribute(key, value) {
        this.attrs[key] = value;
      },
      append(...nodes) {
        this.children.push(...nodes);
      },
      replaceChildren(...nodes) {
        this.children = [...nodes];
      },
      querySelectorAll(sel) {
        const out = [];
        const walk = (n) => {
          if (sel === "#sl-jump-list" && n.id === "sl-jump-list") out.push(n);
          if (sel === "[data-jump]" && n.dataset && n.dataset.jump) out.push(n);
          for (const child of n.children || []) walk(child);
        };
        walk(this);
        return out;
      },
    };
    node.ownerDocument = doc;
    seq += 1;
    node._id = seq;
    return node;
  }
  const doc = { createElement: make };
  const pane = make("div");
  pane.ownerDocument = doc;
  return pane;
}

test("opening Jump several times yields exactly one list", () => {
  const pane = createDocument();
  for (let i = 0; i < 5; i++) renderJumpList(pane);
  const lists = pane.querySelectorAll("#sl-jump-list");
  assert.equal(lists.length, 1);
  const rows = lists[0].querySelectorAll("[data-jump]");
  assert.equal(rows.length, JUMP_PLACES.length);
  const ids = rows.map((row) => row.dataset.jump);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.includes("cameron"), true);
  const cameron = rows.find((row) => row.dataset.jump === "cameron");
  assert.match(cameron.children.map((child) => child.textContent).join(" "), /Sample/);
  for (const place of JUMP_PLACES) {
    assert.equal(place.name.includes("\u2014"), false);
    assert.equal((place.detail || "").includes("\u2014"), false);
    assert.equal((place.detail || "").includes(";"), false);
  }
});
