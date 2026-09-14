function dijkstra(grid, start, end, walls) {
    const gridSize = grid.length;
    const wallSet = new Set(walls.map(w => `${w.r},${w.c}`));
    const visited = [];
    const distances = new Map();
    const cameFrom = new Map();
    const queue = [{ r: start.r, c: start.c, dist: 0 }];
    distances.set(`${start.r},${start.c}`, 0);

    while (queue.length > 0) {
        queue.sort((a, b) => a.dist - b.dist);
        const current = queue.shift();
        const currentKey = `${current.r},${current.c}`;

        if (distances.get(currentKey) < current.dist) continue;

        visited.push({ r: current.r, c: current.c });

        if (current.r === end.r && current.c === end.c) {
            const path = reconstructPath(cameFrom, { r: current.r, c: current.c });
            return { visited, path };
        }

        for (const neighbor of getNeighbors({ r: current.r, c: current.c }, gridSize, wallSet)) {
            const neighborKey = `${neighbor.r},${neighbor.c}`;
            const newDist = current.dist + 1;

            if (!distances.has(neighborKey) || newDist < distances.get(neighborKey)) {
                distances.set(neighborKey, newDist);
                cameFrom.set(neighborKey, currentKey);
                queue.push({ r: neighbor.r, c: neighbor.c, dist: newDist });
            }
        }
    }

    return { visited, path: [] };
}

window.dijkstra = dijkstra;