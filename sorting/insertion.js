function insertionSort(array) {
    const steps = [];
    const arr = [...array];
    const n = arr.length;

    steps.push({ type: 'sorted', i: 0 });

    for (let i = 1; i < n; i++) {
        let j = i;
        while (j > 0) {
            steps.push({ type: 'compare', i: j - 1, j });
            if (arr[j - 1] > arr[j]) {
                steps.push({ type: 'swap', i: j - 1, j });
                [arr[j - 1], arr[j]] = [arr[j], arr[j - 1]];
                j--;
            } else {
                break;
            }
        }
        steps.push({ type: 'sorted', i });
    }
    return steps;
}

window.insertionSort = insertionSort;