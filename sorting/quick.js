function quickSort(array) {
    const steps = [];
    const arr = [...array];

    function partition(low, high) {
        const pivot = arr[high];
        let i = low - 1;
        for (let j = low; j < high; j++) {
            steps.push({ type: 'compare', i: j, j: high });
            if (arr[j] <= pivot) {
                i++;
                if (i !== j) {
                    steps.push({ type: 'swap', i, j });
                    [arr[i], arr[j]] = [arr[j], arr[i]];
                }
            }
        }
        if (i + 1 !== high) {
            steps.push({ type: 'swap', i: i + 1, j: high });
            [arr[i + 1], arr[high]] = [arr[high], arr[i + 1]];
        }
        return i + 1;
    }

    function quickSortRecursive(low, high) {
        if (low < high) {
            const pi = partition(low, high);
            quickSortRecursive(low, pi - 1);
            quickSortRecursive(pi + 1, high);
        }
    }

    quickSortRecursive(0, arr.length - 1);
    for (let i = 0; i < arr.length; i++) {
        steps.push({ type: 'sorted', i });
    }
    return steps;
}

window.quickSort = quickSort;