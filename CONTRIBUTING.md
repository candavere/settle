# Contributing

settle is a solo portfolio project, but issues and pull requests are
welcome.

## Run locally

```
git clone https://github.com/candavere/settle.git
cd settle
open index.html
```

No build step — `index.html` opens directly from disk.

## Run the tests

```
npm ci
npx playwright install --with-deps chromium
npm test
```

## Code style

Match the existing pure-function contract: input in, step array out
(sorting) or `{ visited, path }` out (pathfinding), no DOM access.
4-space indent, small single-purpose functions.

## Known limitations worth filing an issue about

- Chromium-only flagship experience; Firefox uses a static fallback.
- No automated test for an already-sorted input on the sort sections.
- DFS and Dijkstra exist in the codebase but are not in the narrative.