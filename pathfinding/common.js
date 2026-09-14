function reconstructPath(cameFrom, current) {
    const path = [];
    let curr = `${current.r},${current.c}`;
    while (cameFrom.has(curr)) {
        const [r, c] = curr.split(',').map(Number);
        path.unshift({ r, c });
        curr = cameFrom.get(curr);
    }
    return path;
}

function getNeighbors(node, gridSize, walls) {
    const neighbors = [];
    const directions = [
        { dr: -1, dc: 0 },
        { dr: 1, dc: 0 },
        { dr: 0, dc: -1 },
        { dr: 0, dc: 1 },
    ];
    for (const { dr, dc } of directions) {
        const nr = node.r + dr;
        const nc = node.c + dc;
        if (nr >= 0 && nr < gridSize && nc >= 0 && nc < gridSize) {
            const key = `${nr},${nc}`;
            if (!walls.has(key)) {
                neighbors.push({ r: nr, c: nc });
            }
        }
    }
    return neighbors;
}

function heuristic(a, b) {
    return Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
}

window.reconstructPath = reconstructPath;
window.getNeighbors = getNeighbors;
window.heuristic = heuristic;