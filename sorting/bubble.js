function bubbleSort(array) {
    const steps = [];
    const arr = [...array];
    const n = arr.length;

    for (let i = 0; i < n - 1; i++) {
        let swapped = false;
        for (let j = 0; j < n - 1 - i; j++) {
            steps.push({ type: 'compare', i: j, j: j + 1 });
            if (arr[j] > arr[j + 1]) {
                steps.push({ type: 'swap', i: j, j: j + 1 });
                [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
                swapped = true;
            }
        }
        steps.push({ type: 'sorted', i: n - 1 - i });
        if (!swapped) break;
    }
    steps.push({ type: 'sorted', i: 0 });
    return steps;
}

window.bubbleSort = bubbleSort;