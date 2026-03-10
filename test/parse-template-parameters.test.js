import test from "node:test";
import assert from "node:assert/strict";

import { parseTemplateParameters } from "../src/features/prompts/parse-template-parameters.js";

test("parseTemplateParameters scala duplikaty, required i escapowanie stringów", () => {
  const parameters = parseTemplateParameters(`
<% tp.mcpTools.prompt("topic", "Opis z \\\"cytatem\\\"", true) %>
<%* tp.mcpTools.prompt('topic') %>
<%= tp.mcpTools.prompt("language", true) %>
<%- tp.mcpTools.prompt("notes", "Linia 1\\nLinia 2") %>
`);

  assert.deepEqual(parameters, [
    { name: "topic", description: 'Opis z "cytatem"', required: true },
    { name: "language", required: true },
    { name: "notes", description: "Linia 1\nLinia 2" },
  ]);
});

test("parseTemplateParameters ignoruje niepoprawne wywołania i kod poza tagami template", () => {
  const parameters = parseTemplateParameters(`
tp.mcpTools.prompt("outside")
<% tp.mcpTools.prompt(variable) %>
<% tp.mcpTools.prompt("") %>
<% tp.other.prompt("x") %>
`);

  assert.deepEqual(parameters, []);
});
