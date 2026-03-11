import test from "node:test";
import assert from "node:assert/strict";

import {
  DATAVIEW_DQL_CONTENT_TYPE,
  JSON_CONTENT_TYPE,
  JSONLOGIC_CONTENT_TYPE,
  MARKDOWN_CONTENT_TYPE,
  ObsidianRestClient,
  encodeVaultDirectoryPath,
  encodeVaultPath,
  normalizeVaultDirectoryPath,
  normalizeVaultPath,
} from "../src/obsidian-client.js";

interface FetchCall {
  url: string;
  init: { method?: string; headers: Record<string, string>; body?: string };
}

function createFetchRecorder(responseFactory: (url: string, init: unknown) => Response) {
  const calls: FetchCall[] = [];

  return {
    calls,
    fetch: (async (url: string, init: unknown) => {
      calls.push({ url, init } as FetchCall);
      return responseFactory(url, init);
    }) as typeof globalThis.fetch,
  };
}

test("updateActiveFile wysyła markdown UTF-8 bez psucia polskich znaków", async () => {
  const recorder = createFetchRecorder(() => new Response(null, { status: 204 }));
  const client = new ObsidianRestClient({
    baseUrl: "http://obsidian.test",
    apiKey: "sekret",
    fetchImpl: recorder.fetch,
  });

  await client.updateActiveFile("zażółć gęślą jaźń");

  assert.equal(recorder.calls.length, 1);
  assert.equal(recorder.calls[0].url, "http://obsidian.test/active/");
  assert.equal(recorder.calls[0].init.method, "PUT");
  assert.equal(recorder.calls[0].init.headers.Authorization, "Bearer sekret");
  assert.equal(recorder.calls[0].init.headers["Content-Type"], MARKDOWN_CONTENT_TYPE);
  assert.equal(recorder.calls[0].init.body, "zażółć gęślą jaźń");
});

test("patchVaultFile wysyła JSON body z Unicode w ścieżce i polskimi znakami", async () => {
  const recorder = createFetchRecorder(() =>
    new Response("wynik", { status: 200, headers: { "content-type": MARKDOWN_CONTENT_TYPE } }),
  );
  const client = new ObsidianRestClient({
    baseUrl: "http://obsidian.test",
    apiKey: "sekret",
    fetchImpl: recorder.fetch,
  });

  const patched = await client.patchVaultFile({
    filename: "Notatki/zażółć jaźń.md",
    operation: "append",
    targetType: "heading",
    target: "Nagłówek główny::Sekcja ąę",
    content: "Dopisane źć",
    trimTargetWhitespace: true,
  });

  assert.equal(patched, "wynik");
  assert.equal(recorder.calls[0].url, "http://obsidian.test/vault/Notatki/za%C5%BC%C3%B3%C5%82%C4%87%20ja%C5%BA%C5%84.md");
  assert.equal(recorder.calls[0].init.method, "PATCH");
  assert.equal(recorder.calls[0].init.headers["Content-Type"], JSON_CONTENT_TYPE);

  const body = JSON.parse(recorder.calls[0].init.body!);
  assert.equal(body.operation, "append");
  assert.equal(body.targetType, "heading");
  assert.equal(body.target, "Nagłówek główny::Sekcja ąę");
  assert.equal(body.content, "Dopisane źć");
  assert.equal(body.trimTargetWhitespace, true);
  assert.equal(body.createTargetIfMissing, true);
});

test("patchVaultFile serializuje frontmatter z polskimi znakami", async () => {
  const recorder = createFetchRecorder(() =>
    new Response("ok", { status: 200, headers: { "content-type": MARKDOWN_CONTENT_TYPE } }),
  );
  const client = new ObsidianRestClient({
    baseUrl: "http://obsidian.test",
    apiKey: "sekret",
    fetchImpl: recorder.fetch,
  });

  await client.patchVaultFile({
    filename: "frontmatter.md",
    operation: "replace",
    targetType: "frontmatter",
    target: "miasto",
    contentType: JSON_CONTENT_TYPE,
    content: { nazwa: "Łódź", liczba: 2 },
  });

  assert.equal(recorder.calls[0].init.headers["Content-Type"], JSON_CONTENT_TYPE);
  const body = JSON.parse(recorder.calls[0].init.body!);
  assert.equal(body.operation, "replace");
  assert.equal(body.targetType, "frontmatter");
  assert.equal(body.target, "miasto");
  assert.equal(body.content, JSON.stringify({ nazwa: "Łódź", liczba: 2 }));
});

test("patchVaultFile search-replace nie wymaga targetType", async () => {
  const recorder = createFetchRecorder(() =>
    new Response("wynik", { status: 200, headers: { "content-type": MARKDOWN_CONTENT_TYPE } }),
  );
  const client = new ObsidianRestClient({
    baseUrl: "http://obsidian.test",
    apiKey: "sekret",
    fetchImpl: recorder.fetch,
  });

  await client.patchVaultFile({
    filename: "test.md",
    operation: "search-replace",
    target: "- [ ] B4",
    content: "- [x] B4",
  });

  const body = JSON.parse(recorder.calls[0].init.body!);
  assert.equal(body.operation, "search-replace");
  assert.equal(body.target, "- [ ] B4");
  assert.equal(body.content, "- [x] B4");
  assert.equal(body.targetType, undefined);
  assert.equal(body.createTargetIfMissing, undefined);
});

test("normalizeVaultPath odrzuca traversal i zachowuje zwykłe ścieżki", () => {
  assert.equal(normalizeVaultPath("folder/notatka.md"), "folder/notatka.md");
  assert.throws(() => normalizeVaultPath("../sekret.md"), /nieprawidłowa/i);
  assert.throws(() => normalizeVaultPath("folder//plik.md"), /nieprawidłowa/i);
});

test("getServerInfo działa bez skonfigurowanego API key", async () => {
  const recorder = createFetchRecorder(() =>
    new Response(JSON.stringify({ authenticated: false, service: "obsidian" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
  const client = new ObsidianRestClient({
    baseUrl: "http://obsidian.test",
    fetchImpl: recorder.fetch,
  });

  const result = await client.getServerInfo();

  assert.deepEqual(result, { authenticated: false, service: "obsidian" });
  assert.equal(recorder.calls[0].url, "http://obsidian.test/");
  assert.equal(recorder.calls[0].init.headers.Authorization, undefined);
});

test("searchVaultSimple buduje query string z contextLength", async () => {
  const recorder = createFetchRecorder(() =>
    new Response(JSON.stringify({ results: [] }), { status: 200, headers: { "content-type": "application/json" } }),
  );
  const client = new ObsidianRestClient({
    baseUrl: "http://obsidian.test",
    apiKey: "sekret",
    fetchImpl: recorder.fetch,
  });

  await client.searchVaultSimple({ query: "zażółć", contextLength: 25 });

  assert.equal(recorder.calls[0].url, "http://obsidian.test/search/simple/?query=za%C5%BC%C3%B3%C5%82%C4%87&contextLength=25");
  assert.equal(recorder.calls[0].init.method, "POST");
});

test("searchVault ustawia właściwy content-type dla dataview i jsonlogic", async () => {
  const recorder = createFetchRecorder(() =>
    new Response(JSON.stringify({ results: [] }), { status: 200, headers: { "content-type": "application/json" } }),
  );
  const client = new ObsidianRestClient({
    baseUrl: "http://obsidian.test",
    apiKey: "sekret",
    fetchImpl: recorder.fetch,
  });

  await client.searchVault({ queryType: "dataview", query: "TABLE file.name" });
  await client.searchVault({ queryType: "jsonlogic", query: '{"==":[1,1]}' });

  assert.equal(recorder.calls[0].init.headers["Content-Type"], DATAVIEW_DQL_CONTENT_TYPE);
  assert.equal(recorder.calls[1].init.headers["Content-Type"], JSONLOGIC_CONTENT_TYPE);
});

test("showFileInObsidian koduje pełną ścieżkę i newLeaf", async () => {
  const recorder = createFetchRecorder(() => new Response(null, { status: 204 }));
  const client = new ObsidianRestClient({
    baseUrl: "http://obsidian.test",
    apiKey: "sekret",
    fetchImpl: recorder.fetch,
  });

  await client.showFileInObsidian("Folder/zażółć.md", { newLeaf: true });

  assert.equal(recorder.calls[0].url, "http://obsidian.test/open/Folder%2Fza%C5%BC%C3%B3%C5%82%C4%87.md?newLeaf=true");
  assert.equal(recorder.calls[0].init.method, "POST");
});

test("deleteVaultFile wysyła DELETE z poprawnie zakodowaną ścieżką", async () => {
  const recorder = createFetchRecorder(() => new Response(null, { status: 204 }));
  const client = new ObsidianRestClient({
    baseUrl: "http://obsidian.test",
    apiKey: "sekret",
    fetchImpl: recorder.fetch,
  });

  await client.deleteVaultFile("Folder/zażółć.md");

  assert.equal(recorder.calls[0].url, `http://obsidian.test/vault/${encodeVaultPath("Folder/zażółć.md")}`);
  assert.equal(recorder.calls[0].init.method, "DELETE");
});

test("listVaultFiles używa katalogu root albo wskazanego podkatalogu", async () => {
  const recorder = createFetchRecorder(() =>
    new Response(JSON.stringify({ files: [] }), { status: 200, headers: { "content-type": "application/json" } }),
  );
  const client = new ObsidianRestClient({
    baseUrl: "http://obsidian.test",
    apiKey: "sekret",
    fetchImpl: recorder.fetch,
  });

  await client.listVaultFiles();
  await client.listVaultFiles("Notatki/2026");

  assert.equal(recorder.calls[0].url, "http://obsidian.test/vault/");
  assert.equal(recorder.calls[1].url, `http://obsidian.test/vault/${encodeVaultDirectoryPath("Notatki/2026")}/`);
  assert.equal(normalizeVaultDirectoryPath("Notatki/2026"), "Notatki/2026");
});

test("executeTemplate serializuje payload z argumentami i targetPath", async () => {
  const recorder = createFetchRecorder(() =>
    new Response(JSON.stringify({ message: "ok", content: "Wynik ąćę" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
  const client = new ObsidianRestClient({
    baseUrl: "http://obsidian.test",
    apiKey: "sekret",
    fetchImpl: recorder.fetch,
  });

  const result = await client.executeTemplate({
    name: "Templates/daily.md",
    arguments: { tytul: "Zażółć", data: "2026-03-07" },
    createFile: true,
    targetPath: "Dziennik/2026-03-07.md",
  });

  assert.deepEqual(result, { message: "ok", content: "Wynik ąćę" });
  assert.equal(recorder.calls[0].url, "http://obsidian.test/templates/execute");
  assert.equal(recorder.calls[0].init.headers["Content-Type"], JSON_CONTENT_TYPE);
  assert.equal(
    recorder.calls[0].init.body,
    JSON.stringify({
      name: "Templates/daily.md",
      arguments: { tytul: "Zażółć", data: "2026-03-07" },
      createFile: true,
      targetPath: "Dziennik/2026-03-07.md",
    }),
  );
});
