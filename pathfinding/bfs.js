function bfs(grid, start, end, walls) {
    const gridSize = grid.length;
    const wallSet = new Set(walls.map(w => `${w.r},${w.c}`));
    const visited = [];
    const queue = [start];
    const cameFrom = new Map();
    const visitedSet = new Set([`${start.r},${start.c}`]);

    while (queue.length > 0) {
        const current = queue.shift();
        visited.push(current);

        if (current.r === end.r && current.c === end.c) {
            const path = reconstructPath(cameFrom, current);
            return { visited, path };
        }

        for (const neighbor of getNeighbors(current, gridSize, wallSet)) {
            const key = `${neighbor.r},${neighbor.c}`;
            if (!visitedSet.has(key)) {
                visitedSet.add(key);
                cameFrom.set(key, `${current.r},${current.c}`);
                queue.push(neighbor);
            }
        }
    }

    return { visited, path: [] };
}

window.bfs = bfs;