/* Runs every test/test_*.js as its own child process. Each test script calls
   process.exit() on completion, so tests cannot share the runner's process. */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const testFiles = fs.readdirSync(__dirname)
    .filter((f) => f.startsWith('test_') && f.endsWith('.js'))
    .sort();

let failed = 0;
console.log(`\nRunning ${testFiles.length} test suite(s): ${testFiles.join(', ')}\n`);
for (const file of testFiles) {
    console.log(`===== ${file} =====`);
    const res = spawnSync(process.execPath, [path.join(__dirname, file)], { stdio: 'inherit' });
    console.log('');
    if (res.status !== 0) failed++;
}

console.log(failed === 0
    ? `ALL ${testFiles.length} SUITE(S) PASSED`
    : `${failed} OF ${testFiles.length} SUITE(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);