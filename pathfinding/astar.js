function astar(grid, start, end, walls) {
    const gridSize = grid.length;
    const wallSet = new Set(walls.map(w => `${w.r},${w.c}`));
    const visited = [];
    const gScore = new Map();
    const fScore = new Map();
    const cameFrom = new Map();
    const openSet = [{ r: start.r, c: start.c, f: heuristic(start, end) }];
    gScore.set(`${start.r},${start.c}`, 0);
    fScore.set(`${start.r},${start.c}`, heuristic(start, end));

    while (openSet.length > 0) {
        openSet.sort((a, b) => a.f - b.f);
        const current = openSet.shift();
        const currentKey = `${current.r},${current.c}`;

        if (fScore.get(currentKey) < current.f) continue;

        visited.push({ r: current.r, c: current.c });

        if (current.r === end.r && current.c === end.c) {
            const path = reconstructPath(cameFrom, { r: current.r, c: current.c });
            return { visited, path };
        }

        for (const neighbor of getNeighbors({ r: current.r, c: current.c }, gridSize, wallSet)) {
            const neighborKey = `${neighbor.r},${neighbor.c}`;
            const tentativeG = gScore.get(currentKey) + 1;

            if (!gScore.has(neighborKey) || tentativeG < gScore.get(neighborKey)) {
                cameFrom.set(neighborKey, currentKey);
                gScore.set(neighborKey, tentativeG);
                const f = tentativeG + heuristic(neighbor, end);
                fScore.set(neighborKey, f);

                /* If the neighbor is already queued, refresh its f in place.
                   Otherwise a stale high-f entry would be skipped as "old"
                   when it pops, and the improved cell would never expand. */
                const queued = openSet.find(n => n.r === neighbor.r && n.c === neighbor.c);
                if (queued) {
                    queued.f = f;
                } else {
                    openSet.push({ r: neighbor.r, c: neighbor.c, f });
                }
            }
        }
    }

    return { visited, path: [] };
}

window.astar = astar;