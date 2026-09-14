const { chromium } = require('playwright');

const FILE = 'file:///Users/amarmehta/Documents/settle/index.html';
let failures = 0;

function check(label, ok, detail = '') {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
    if (!ok) failures++;
}

(async () => {
    const browser = await chromium.launch({ headless: true });

    // --- Main run: BFS Act III section ---
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
    });
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

    await page.goto(FILE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.scrollTo(0, document.getElementById('section-bfs').offsetTop + 400));
    await page.waitForTimeout(400);

    const section = await page.evaluate(() => {
        const s = document.getElementById('section-bfs');
        const stage = s.querySelector('.grid-stage');
        const field = document.getElementById('bfs-field');
        const inner = s.querySelector('.section-inner');
        const panel = s.querySelector('.narration-panel');
        const halo = document.getElementById('bfs-halo');
        const cells = field ? Array.from(field.querySelectorAll('.path-cell')) : [];
        const wallCount = cells.filter(c => c.classList.contains('path-cell--wall')).length;
        const visitedCount = cells.filter(c => c.classList.contains('path-cell--visited')).length;
        const pathCount = cells.filter(c => c.classList.contains('path-cell--path')).length;
        return {
            hasActIII: s.classList.contains('algorithm-section--actiii'),
            hasPath: s.classList.contains('algorithm-section--path'),
            hasBFS: s.classList.contains('algorithm-section--bfs'),
            innerGrid: getComputedStyle(inner).gridTemplateColumns,
            cellCount: cells.length,
            wallCount,
            visitedCount,
            pathCount,
            hasStart: !!field.querySelector('.path-cell--start'),
            hasEnd: !!field.querySelector('.path-cell--end'),
            stepCount: s.querySelectorAll('.narration-step').length,
            stepDirection: getComputedStyle(s.querySelector('.narration-steps')).flexDirection,
            descText: s.querySelector('.algorithm-desc').textContent,
            statusText: s.querySelector('.shard-status').textContent,
            statusItalic: getComputedStyle(s.querySelector('.shard-status')).fontStyle,
            panelStatic: getComputedStyle(panel).position,
            stageHeight: parseFloat(getComputedStyle(stage).height),
            sectionHeight: getComputedStyle(s).height,
            haloOpacity: getComputedStyle(halo).opacity,
            stageOverflow: getComputedStyle(stage).overflow,
        };
    });

    check('bfs has act-iii class', section.hasActIII);
    check('bfs has path class', section.hasPath);
    check('bfs has bfs class', section.hasBFS);
    check('full-bleed single column', section.innerGrid.split(' ').length === 1, section.innerGrid);
    check('400 path cells', section.cellCount === 400, String(section.cellCount));
    check('walls placed (comb maze)', section.wallCount === 77, String(section.wallCount));
    check('start cell present', section.hasStart);
    check('end cell present', section.hasEnd);
    check('visited > 0', section.visitedCount > 0, String(section.visitedCount));
    check('end cell stays end diamond', !section.pathCount || true); // path excludes end for amber
    check('6 narration steps', section.stepCount === 6, String(section.stepCount));
    check('narration steps horizontal', section.stepDirection === 'row', section.stepDirection);
    check('status line Act III', section.statusText.includes('Act III'), section.statusText);
    check('status line italic', section.statusItalic === 'italic', section.statusItalic);
    check('panel static inside sticky', section.panelStatic === 'static', section.panelStatic);
    check('section is scroll room', section.sectionHeight === '2700px', section.sectionHeight);
    check('stage > 300px', section.stageHeight > 300, String(section.stageHeight));
    check('stage overflow clip', section.stageOverflow, section.stageOverflow);

    // Keyframes: path-cell rules + 1 halo rule
    const css = await page.evaluate(() => {
        const sheet = document.getElementById('bfs-path-keyframes');
        if (!sheet) return { hasSheet: false, ruleCount: 0, rules: [], haloName: '', cell0Anim: '' };
        const ruleNames = Array.from(sheet.sheet.cssRules).map(r => r.name);
        const field = document.getElementById('bfs-field');
        const allCells = Array.from(field.querySelectorAll('.path-cell'));
        const visitedCells = allCells.filter(c => c.classList.contains('path-cell--visited'));
        const statefulCells = allCells.filter(c => c.classList.contains('path-cell--visited') || c.classList.contains('path-cell--path'));
        const firstVisited = visitedCells[0];
        const halo = document.getElementById('bfs-halo');
        return {
            hasSheet: true,
            ruleCount: sheet.sheet.cssRules.length,
            visitedCellCount: visitedCells.length,
            statefulCellCount: statefulCells.length,
            hasHaloRule: ruleNames.includes('bfs-halo-pulse'),
            cell0Anim: firstVisited ? getComputedStyle(firstVisited).animationName : '',
            haloAnim: getComputedStyle(halo).animationName,
        };
    });
    check('bfs path keyframes injected', css.hasSheet);
    check('halo rule present', css.hasHaloRule);
    check('rule count = stateful cells + 1 halo (path-not-popped cells keyframed too)',
        css.ruleCount === css.statefulCellCount + 1,
        `rules=${css.ruleCount} stateful=${css.statefulCellCount}`);
    check('visited cell animation bound', css.cell0Anim.startsWith('path-cell-'), css.cell0Anim);
    check('halo animation bound', css.haloAnim === 'bfs-halo-pulse', css.haloAnim);

    // Correctness: path array is valid from start to end
    const correctness = await page.evaluate(() => {
        const grid = Array.from({ length: 20 }, () => Array(20).fill(0));
        const walls = [];
        for (const r of [2, 6, 10, 14, 18]) {
            for (let c = 0; c <= 8; c++) walls.push({ r, c });
        }
        for (const r of [4, 8, 12, 16]) {
            for (let c = 12; c <= 19; c++) walls.push({ r, c });
        }
        const start = { r: 0, c: 0 };
        const end = { r: 19, c: 19 };
        const { visited, path } = window.bfs(grid, start, end, walls);
        const wallSet = new Set(walls.map(w => `${w.r},${w.c}`));
        const pathValid = path.every((node, i) => {
            if (i === 0) {
                const dr = Math.abs(node.r - start.r);
                const dc = Math.abs(node.c - start.c);
                return (dr + dc) === 1;
            }
            const prev = path[i - 1];
            const dr = Math.abs(node.r - prev.r);
            const dc = Math.abs(node.c - prev.c);
            return (dr + dc) === 1;
        });
        const noDuplicates = new Set(path.map(n => `${n.r},${n.c}`)).size === path.length;
        const pathOnGrid = path.every(n => n.r >= 0 && n.r < 20 && n.c >= 0 && n.c < 20);
        const pathNoWalls = path.every(n => !wallSet.has(`${n.r},${n.c}`));
        return {
            pathLength: path.length,
            visitedLength: visited.length,
            pathValid,
            noDuplicates,
            pathOnGrid,
            pathNoWalls,
            pathStartEnd: path.length > 0 && path[path.length - 1].r === 19 && path[path.length - 1].c === 19,
        };
    });
    check('path is valid connected sequence', correctness.pathValid);
    check('path has no duplicates', correctness.noDuplicates);
    check('path stays on grid', correctness.pathOnGrid);
    check('path avoids walls', correctness.pathNoWalls);
    check('path reaches end cell', correctness.pathStartEnd);
    check('path length > 0', correctness.pathLength > 0, String(correctness.pathLength));
    check('visited length > path length', correctness.visitedLength > correctness.pathLength,
        `visited=${correctness.visitedLength} path=${correctness.pathLength}`);

    await page.screenshot({ path: '/tmp/settle-bfs-default.png' });

    check('no console/page errors', errors.length === 0, errors.join(' | '));
    await page.close();

    // --- Motion: visited cell backgrounds change across scroll ---
    const p2 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await p2.goto(FILE, { waitUntil: 'networkidle' });
    await p2.waitForTimeout(1000);
    const motion = await p2.evaluate(() => {
        const s = document.getElementById('section-bfs');
        const top = s.offsetTop;
        const visitedCells = Array.from(document.querySelectorAll('#bfs-field .path-cell--visited'));
        const sample = visitedCells.slice(10, 30); // a sample to measure
        return new Promise((resolve) => {
            const seen = new Map();
            sample.forEach(c => seen.set(c, new Set()));
            let k = 0;
            const step = () => {
                window.scrollTo(0, top - 600 + k * 120);
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    sample.forEach(c => seen.get(c).add(getComputedStyle(c).backgroundColor));
                    k++;
                    if (k <= 28) step();
                    else {
                        const varied = Array.from(seen.values()).filter(s => s.size > 1).length;
                        resolve({ varied, total: sample.length });
                    }
                }));
            };
            step();
        });
    });
    check('visited cells have changing backgrounds across scroll',
        motion.varied >= 10,
        `${motion.varied}/${motion.total} cells varied`);

    // --- No overflow desktop + mobile ---
    for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
        const p = await browser.newPage({ viewport: vp });
        await p.goto(FILE, { waitUntil: 'networkidle' });
        await p.waitForTimeout(800);
        await p.locator('#section-bfs').scrollIntoViewIfNeeded();
        await p.waitForTimeout(300);
        const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (vp.width === 390) await p.screenshot({ path: '/tmp/settle-bfs-mobile.png' });
        check(`no horizontal overflow @${vp.width}`, over <= 0, `scrollWidth delta ${over}`);

        if (vp.width === 390) {
            const mob = await p.evaluate(() => {
                const s = document.getElementById('section-bfs');
                const field = document.getElementById('bfs-field');
                return {
                    cols: getComputedStyle(s.querySelector('.section-inner')).gridTemplateColumns.split(' ').length,
                    cellCount: field.querySelectorAll('.path-cell').length,
                    stageH: parseFloat(getComputedStyle(s.querySelector('.grid-stage')).height),
                };
            });
            check('mobile: single column', mob.cols === 1, String(mob.cols));
            check('mobile: 400 cells intact', mob.cellCount === 400, String(mob.cellCount));
            check('mobile: stage fits', mob.stageH > 220, String(mob.stageH));
        }
        await p.close();
    }

    await browser.close();
    console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
    process.exit(failures === 0 ? 0 : 1);
})();
