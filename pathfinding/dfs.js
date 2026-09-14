function dfs(grid, start, end, walls) {
    const gridSize = grid.length;
    const wallSet = new Set(walls.map(w => `${w.r},${w.c}`));
    const visited = [];
    const stack = [start];
    const cameFrom = new Map();
    const visitedSet = new Set([`${start.r},${start.c}`]);

    while (stack.length > 0) {
        const current = stack.pop();
        visited.push(current);

        if (current.r === end.r && current.c === end.c) {
            const path = reconstructPath(cameFrom, current);
            return { visited, path };
        }

        const neighbors = getNeighbors(current, gridSize, wallSet);
        for (const neighbor of neighbors) {
            const key = `${neighbor.r},${neighbor.c}`;
            if (!visitedSet.has(key)) {
                visitedSet.add(key);
                cameFrom.set(key, `${current.r},${current.c}`);
                stack.push(neighbor);
            }
        }
    }

    return { visited, path: [] };
}

window.dfs = dfs;