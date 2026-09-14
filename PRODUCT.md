# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static HTML/CSS + vanilla JavaScript (ES6+), no frameworks, no build tools, no external dependencies. Decided in SPEC.md for a student portfolio project.

## Users

Primary audience is technical evaluators — recruiters and engineers reviewing the author's student portfolio (inferred from user confirmation in the init interview). Their job is to quickly assess the author's algorithm knowledge, code organization, and architecture decisions.

## Product Purpose

SortViz is a browser-based algorithm visualizer that animates sorting and pathfinding algorithms in real time, ahead of any implementation. It demonstrates algorithms, data structures, DOM manipulation, and clean code organization. Success means a viewer can understand *what* an algorithm does by watching it run and *how well it was built* by reading the code.

## Positioning

The step-array architecture is what a neighboring portfolio project cannot truthfully copy: algorithms are pure functions emitting a serialized description of their behavior (`compare`, `swap`, `overwrite`, `sorted`), decoupled from the DOM renderer that animates them. Sorting and pathfinding share this one extensible pattern, so adding an algorithm is one file plus one script tag.

## Operating Context

Used in a browser on real data the user controls: 10–100 element arrays across five sorting algorithms, and a fixed 20×20 pathfinding grid across four algorithms, with user-drawn walls. Animation speed is user-adjustable. Runs without a server or install step (open `index.html` directly, or serve statically). Confirmed in SPEC.md.

## Capabilities and Constraints

- Sorting: bubble, selection, insertion, merge, quick (Lomuto partition). Pure functions returning step arrays with a fixed contract. (SPEC.md)
- Pathfinding: BFS, DFS, Dijkstra (sorted-array priority queue, not a min-heap), A* (Manhattan heuristic). Return `{ visited, path }`. (SPEC.md)
- All rendering and animation lives in `narrative.js` (scroll-driven keyframes, static-settled fallback); algorithms never touch the DOM. (AGENTS.md)
- The narrative is the only view; `NarrativeState` owns the controller state, and the hero slab + narration keyboard nav are the only interactive surfaces. (AGENTS.md)
- Known deliberate limits: 20×20 grid, fixed corner start/end, no diagonal movement, no step counter. (SPEC.md "Known Limitations")
- No new dependencies of any kind — if a task seems to require one, it is flagged, not added. (AGENTS.md)
- Undecided: drag start/end nodes, dark/light theme toggle, side-by-side comparison, GIF export, mobile touch support (deferred in SPEC.md; do not start without confirming scope).

## Brand Commitments

- Name: SortViz. (SPEC.md)
- Dark theme with color-coded algorithm states is a binding visual constraint (SPEC.md): sort bars default red, comparing yellow, swapping light red, sorted green; pathfinding cells wall gray, visited blue, path yellow. Recorded because SPEC.md commits to it; no further aesthetic commitments exist (user confirmed).
- README hook: "Watch sorting and pathfinding algorithms come to life with real-time animations." (SPEC.md)

## Evidence on Hand

- SPEC.md and AGENTS.md define the full functional contract and process. No implemented code, screenshots, demos, or testimonials exist yet; nothing may be fabricated in their place. No automation test framework exists; verification is manual or via Playwright CLI as described in AGENTS.md.

## Product Principles

1. Clarity over cleverness — code clarity and correctness matter more than cleverness or performance tricks.
2. Algorithms are pure and isolated — no DOM access, no shared state leak; the step contract is sacred and not special-cased per algorithm.
3. One pattern for extension — a new algorithm is one file plus one script tag; anything that breaks that pattern is flagged, not hacked.
4. Deliberate scope — known limitations are documented and respected; scope additions require explicit confirmation.
5. Visual quality is part of the deliverable — the dark theme and color-coded states must read as deliberately designed, not default-generated output.

## Accessibility & Inclusion

WCAG AA basics confirmed in the init interview: states must be distinguishable without relying on hue alone (color + pattern/label where two states can meet), controls keyboard-accessible, and visible focus states. No specific user needs beyond this were established.