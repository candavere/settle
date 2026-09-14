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
- All four pathfinding sections run on the same fixed 20×20 comb maze;
  there is no way to swap in a different layout.
- The static fallback (reduced motion / no scroll-timeline support)
  renders each stage's settled end state, not a step-through.