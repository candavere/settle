# settle

**A scroll-driven algorithm visualizer where sorting and pathfinding crystallize in place as you scroll.**

Vanilla JS · Zero dependencies · CSS-native scroll animations

<br>

### 🎬 [Click here to experience the live demo →](https://settle-candavere.vercel.app)

<br>

As you scroll, nine algorithms crystallize in place — unsorted values heat to amber, swap hot, and cool into a settled quartz layer. Sorting first, then pathfinding, narrated as a single continuous film. No timers. No step buttons. Just scroll.
---
## What it is

settle presents two things — sorting and pathfinding — the way a geode
presents rock: raw on the outside, order underneath. The visual system is
built on that metaphor. Raw, unsettled data is shale. A compare
interrupting a scan is amber. A swap in flight is hot amber with a lifted
bevel. Values that have found their final slot cool to a dark quartz —
they are, in the story of the page, *crystallized*.

That metaphor is why the project looks the way it does, and the whole thing
runs down a single scroll:

- a **hero** you hold to settle — press and hold the slab, or click, and
  the noise of raw values resolves upward into sorted order;
- **Act I** — the O(n²) sorts, each rendered as shard fields with compare,
  swap, and settle states;
- **Act II** — merge and quick sort, with the overwrite and pivot
  mechanics drawn explicitly;
- **Act III** — BFS, Dijkstra, A*, and DFS against the same maze —
  wavefront, cheapest ring, guided tilt, and a deep dive;
- a **footer** where six veins converge into stillness — the geode is
  done forming.

Algorithms are pure functions. Rendering is a smoke-and-mirrors layer on
top. The entire narrative bends around scroll position using CSS-native
scroll-driven animations — no timers, no step-throughs, no canvas.

## Features

### Sorting — Act I and Act II

Five algorithms: bubble, selection, insertion, merge, and quick sort
(Lomuto partition).

Each sorting section is a 300vh scroll choreography. The algorithm runs,
its step array is converted into CSS keyframes, and the bars enter the
viewport already mid-algorithm — by the time a section pins on screen, the
compare/swap/settle drama is happening in the scroll position rather than
in time. The state vocabulary is consistent across all five:

| State | Reading |
|---|---|
| shale | raw, untouched, still in the noise |
| amber | being compared |
| hot amber | swapped, lifted, moving |
| quartz | settled — final position, cooled and locked |

Merge sort deliberately never swaps; its `overwrite` steps are animated as
lanes being rewritten, so the front-facing claim of the step contract is
visually honest.

### Pathfinding — Act III

Four searches face the same 20×20 comb maze and the same corners,
sequentially, in the same section rhythm that the sorts use.

BFS floods the whole grid — a bone-white halo pulses ring by ring and the
wavefront proof of the shortest path is drawn amber from start to end.

Dijkstra expands the cheapest unvisited cell every step. Every move costs
one on this unweighted grid, so distance grows in rings and it reaches
the goal the same way BFS does — the same 323 cells, the same shortest
path. The section says plainly what is true: with nothing to weigh,
Dijkstra reduces to BFS.

A* presents the same maze so the comparison is fair: the frontier visibly
*leans* toward the goal (a tilt motif drawn across the grid), dead-end
pockets stay closed, and the narration says what is true on this layout —
"A* opens a third fewer cells" (206 vs. BFS's 323) — and then draws the
*same* shortest path home.

DFS dives deep down one branch before it ever backtracks — a stack, not a
queue. On this maze it finds a route quickly but not a short one: a
190-step wander versus BFS's guaranteed 38. That is the honest gap the
narration admits: DFS finds *a* path, never the pledge of the shortest.

The amber path draw is the payoff in every section.

## What's interesting about this project

### A real A* bug, found by making it pretty

Building the visualizer surfaced an actual correctness bug in the
pathfinding act. In a standard A* open-list you may enqueue a neighbor,
later discover a *better* g-score for it, and need to decrease its queued
key. The original implementation handled that poorly: when a stale entry
was popped it was skipped, but the improved cell was never re-pushed — so
on a maze-like grid the search could terminate at a dead end with `path: []`.
The fix refreshes the queued entry's f-score in place instead of refusing
the improvement. On the friendly default grid the bug never showed
(everything just floods); designing the maze the narrative needed is what
surfaced it. The maze layout and the bug have the same root cause — honest
comparisons demand layouts where the heuristic matters.

### CSS-native scroll-driven animation, with a fallback that isn't a lie

The whole page is `animation-timeline: view()` and `animation-range`,
wrapped in `@supports`. The animated experience treats scroll position as
the timeline, so there's no timer orchestration anywhere in the narrative
— you scrub backward and the algorithm un-runs. Browsers without scroll
timeline support get the same narrative as a static, readable page: every
section laid out in flow with its settled final state — the hero
crystallized, the sorts columned, the paths drawn. `prefers-reduced-motion`
gets the same treatment. There is no second interface; there is one
narrative, and the page decides whether to animate it.

### The no-dependency constraint shaped everything

No npm packages, no CDN tags, no bundlers — the one `package.json`-adjacent
artifact is a test-only Playwright check-in. That rule forced two things
worth defending in an interview:

- algorithms had to be pure and testable in isolation, because there was
  nothing to hide the complexity behind;
- the animation layer is a small amount of hand-rolled CSS/JS that has to
  *earn its keep* — you can read all of it in an afternoon.

### The metaphor is the organizing principle

The project is designed around a geode crystallizing. That one decision
makes every later one look deliberate: the palette (shale, ore, strata,
bone, citrine), the "one bright glint per section" rule, the held-to-settle
hero, and the footer's veins converging into stillness. The metaphor isn't
decoration layered on — it decided the states and the narrative order.
It's a portfolio piece, and the design language is arguing for itself as
you scroll.

## Algorithm contracts

Every algorithm is a pure function: input in, step description out, zero
DOM access. The renderers turn the steps into keyframes or cell classes.
Algorithms don't know a browser exists.

```javascript
// sorting/<name>.js — takes an array, returns steps
[
  { type: 'compare', i: 3, j: 4 },
  { type: 'swap',    i: 3, j: 4 },
  { type: 'sorted',  i: 0 },
]

// pathfinding/<name>.js — takes (grid, start, end, walls), returns
{
  visited: ['3,4', /* ... every cell explored, in order */],
  path: ['0,0', /* ... start to end */],
}
```

The four sorting step shapes — `compare`, `swap`, `overwrite`, `sorted` —
are the entire language the five sort sections speak; merge's
`overwrite` is how the animation stays honest. Adding an algorithm is one
file, one `<script>` tag, and one entry in the algorithm table in
`narrative.js` — the contract stays the same either way.

## How to run

```bash
git clone https://github.com/candavere/settle.git && cd settle
open index.html
```

There is no build step. The page works from a `file://` open in any
browser; the scroll narrative needs `animation-timeline: view()` support
(see below).

## Browser support

The full scroll-narrative experience is CSS-native scroll-driven animation,
which at the time of writing means full support in Chromium-based browsers
(Chrome, Edge). Safari and older Firefox fall back to the same narrative as
a static page — laid out in flow, every stage settled — via the same
`@supports` gate, so you never get a broken narrative, just one that isn't
scrolling. This is stated honestly rather than smoothed over: the page
knows the difference and shows you the right presentation either way.

## License

MIT
