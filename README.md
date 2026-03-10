# mcp-obsidian

Lekki, unowocześniony serwer MCP dla Obsidiana, zbudowany jako cienka warstwa nad Obsidian Local REST API.

## Założenia projektu

- brak ciężkich zależności na start,
- poprawny `UTF-8` dla treści markdown,
- zgodność z `PATCH v3`,
- struktura feature-based z małym kosztem utrzymania,
- testy regresyjne dla polskich znaków.

## Wymagania

- Node.js `>=20`
- działający plugin Obsidian Local REST API
- ustawiony klucz API
- opcjonalnie plugin Smart Connections dla `search_vault_smart`
- opcjonalnie plugin Templater oraz endpoint pluginu MCP dla `execute_template` i `prompts/get`

## Konfiguracja

Serwer czyta konfigurację z env:

- `OBSIDIAN_API_KEY` — wymagany klucz Bearer do Local REST API
- `OBSIDIAN_REST_URL` — opcjonalnie, domyślnie `http://127.0.0.1:27124`
- `OBSIDIAN_REQUEST_TIMEOUT_MS` — opcjonalnie, domyślnie `30000`

## Uruchomienie lokalne

```bash
export OBSIDIAN_API_KEY="twoj-klucz"
export OBSIDIAN_REST_URL="http://127.0.0.1:27124"
node src/index.js
```

## Dostępne narzędzia MCP

- `fetch`
- `get_server_info`
- `get_active_file`
- `update_active_file`
- `append_to_active_file`
- `patch_active_file`
- `delete_active_file`
- `show_file_in_obsidian`
- `search_vault`
- `search_vault_simple`
- `list_vault_files`
- `get_vault_file`
- `create_vault_file`
- `append_to_vault_file`
- `patch_vault_file`
- `delete_vault_file`
- `search_vault_smart`
- `execute_template`

## Dostępne prompty MCP

Serwer obsługuje również capability `prompts`:

- `prompts/list`
- `prompts/get`

Prompty są wykrywane w katalogu `Prompts/` vaulta. Serwer:

- czyta pliki `.md`,
- filtruje tylko notatki z tagiem `mcp-tools-prompt`,
- wyciąga argumenty z wywołań `tp.mcpTools.prompt(...)`,
- wykonuje template przez `/templates/execute`,
- usuwa frontmatter z końcowej treści promptu.

Obsługiwane są m.in. formy:

- `tp.mcpTools.prompt("name")`
- `tp.mcpTools.prompt("name", "opis")`
- `tp.mcpTools.prompt("name", "opis", true)`
- `tp.mcpTools.prompt("name", true)`

## Najważniejsze różnice względem porzuconego projektu

- `PATCH` wysyła nagłówki zgodne z aktualnym `v3`
- wszystkie operacje tekstowe wymuszają `text/markdown; charset=utf-8`
- ścieżki vault są kodowane segmentami, więc katalogi dalej działają
- `get_server_info` działa także bez skonfigurowanego `OBSIDIAN_API_KEY`
- dochodzi pełna obsługa MCP `prompts` zamiast samego `tools`
- runtime, transport i prompty są rozdzielone od warstwy narzędzi
- testy obejmują polskie znaki, budowę nagłówków `PATCH`, pełną listę narzędzi i prompty

## Struktura projektu

- `src/runtime/` — runtime MCP i transport `stdio`
- `src/features/prompts/` — wykrywanie i wykonywanie promptów
- `src/features/tools/` — źródłowa implementacja rejestru narzędzi, walidacji i helperów wyników
- `src/lib/obsidian/` — źródłowa implementacja klienta Obsidian REST API i utili patch/path/request
- `src/lib/fetch/` — fasada lekkiego fetchera WWW
- `src/*.js` — cienkie punkty kompatybilności dla dotychczasowych importów

## Przykład integracji MCP

Przykładowa komenda serwera:

```json
{
  "command": "node",
  "args": ["/sciezka/do/mcp-obsidian/src/index.js"],
  "env": {
    "OBSIDIAN_API_KEY": "twoj-klucz",
    "OBSIDIAN_REST_URL": "http://127.0.0.1:27124"
  }
}
```

## Testy

```bash
npm test
```

## Dalsze możliwe kroki

- dodać publikowalny pakiet npm,
- dodać test integracyjny z uruchomionym Obsidian Local REST API,
- dodać testy integracyjne dla Smart Connections i Templater,
- dopisać opcjonalną warstwę logowania strukturalnego MCP,
- rozważyć dokładniejszą konwersję HTML -> Markdown w narzędziu `fetch`.