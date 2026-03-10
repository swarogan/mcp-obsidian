import test from "node:test";
import assert from "node:assert/strict";

import { ToolArgumentError, createToolRegistry } from "../src/tools.js";

test("src/tools.js zachowuje kompatybilne eksporty", () => {
  assert.equal(typeof createToolRegistry, "function");

  const error = new ToolArgumentError("błąd");
  assert.equal(error.name, "ToolArgumentError");
  assert.equal(error.message, "błąd");
});