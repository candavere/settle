function mergeSort(array) {
    const steps = [];
    const arr = [...array];

    function merge(left, right, startIdx) {
        let i = 0, j = 0, k = startIdx;
        while (i < left.length && j < right.length) {
            steps.push({ type: 'compare', i: startIdx + i, j: startIdx + left.length + j });
            if (left[i] <= right[j]) {
                steps.push({ type: 'overwrite', i: k, value: left[i] });
                arr[k] = left[i];
                i++;
            } else {
                steps.push({ type: 'overwrite', i: k, value: right[j] });
                arr[k] = right[j];
                j++;
            }
            k++;
        }
        while (i < left.length) {
            steps.push({ type: 'overwrite', i: k, value: left[i] });
            arr[k] = left[i];
            i++;
            k++;
        }
        while (j < right.length) {
            steps.push({ type: 'overwrite', i: k, value: right[j] });
            arr[k] = right[j];
            j++;
            k++;
        }
    }

    function mergeSortRecursive(start, end) {
        if (end - start <= 1) return;
        const mid = Math.floor((start + end) / 2);
        mergeSortRecursive(start, mid);
        mergeSortRecursive(mid, end);
        const left = arr.slice(start, mid);
        const right = arr.slice(mid, end);
        merge(left, right, start);
    }

    const n = arr.length;
    mergeSortRecursive(0, n);
    for (let i = 0; i < n; i++) {
        steps.push({ type: 'sorted', i });
    }
    return steps;
}

window.mergeSort = mergeSort;