function selectionSort(array) {
    const steps = [];
    const arr = [...array];
    const n = arr.length;

    for (let i = 0; i < n - 1; i++) {
        let minIdx = i;
        for (let j = i + 1; j < n; j++) {
            steps.push({ type: 'compare', i: minIdx, j });
            if (arr[j] < arr[minIdx]) {
                minIdx = j;
            }
        }
        if (minIdx !== i) {
            steps.push({ type: 'swap', i, j: minIdx });
            [arr[i], arr[minIdx]] = [arr[minIdx], arr[i]];
        }
        steps.push({ type: 'sorted', i });
    }
    steps.push({ type: 'sorted', i: n - 1 });
    return steps;
}

window.selectionSort = selectionSort;