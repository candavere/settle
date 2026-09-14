const { chromium } = require('playwright');

const FILE = 'file:///Users/amarmehta/Documents/settle/index.html';
let failures = 0;

function check(label, ok, detail = '') {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
    if (!ok) failures++;
}

(async () => {
    const browser = await chromium.launch({ headless: true });

    // --- Main run: A* Act III section ---
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
    });
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

    await page.goto(FILE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.scrollTo(0, document.getElementById('section-astar').offsetTop + 400));
    await page.waitForTimeout(400);

    const section = await page.evaluate(() => {
        const s = document.getElementById('section-astar');
        const stage = s.querySelector('.grid-stage');
        const field = document.getElementById('astar-field');
        const inner = s.querySelector('.section-inner');
        const panel = s.querySelector('.narration-panel');
        const tilt = document.getElementById('astar-tilt');
        const cells = field ? Array.from(field.querySelectorAll('.path-cell')) : [];
        const wallCount = cells.filter(c => c.classList.contains('path-cell--wall')).length;
        const visitedCount = cells.filter(c => c.classList.contains('path-cell--visited')).length;
        const pathCount = cells.filter(c => c.classList.contains('path-cell--path')).length;
        return {
            hasActIII: s.classList.contains('algorithm-section--actiii'),
            hasPath: s.classList.contains('algorithm-section--path'),
            hasAstar: s.classList.contains('algorithm-section--astar'),
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
            tiltWidth: parseFloat(getComputedStyle(tilt).width),
            tiltOpacity: getComputedStyle(tilt).opacity,
            stageOverflow: getComputedStyle(stage).overflow,
        };
    });

    check('astar has act-iii class', section.hasActIII);
    check('astar has path class', section.hasPath);
    check('astar has astar class', section.hasAstar);
    check('full-bleed single column', section.innerGrid.split(' ').length === 1, section.innerGrid);
    check('400 path cells', section.cellCount === 400, String(section.cellCount));
    check('walls placed (comb maze)', section.wallCount === 77, String(section.wallCount));
    check('start cell present', section.hasStart);
    check('end cell present', section.hasEnd);
    check('visited > 0', section.visitedCount > 0, String(section.visitedCount));
    check('6 narration steps', section.stepCount === 6, String(section.stepCount));
    check('narration steps horizontal', section.stepDirection === 'row', section.stepDirection);
    check('status line Act III', section.statusText.includes('Act III'), section.statusText);
    check('status line italic', section.statusItalic === 'italic', section.statusItalic);
    check('panel static inside sticky', section.panelStatic === 'static', section.panelStatic);
    check('section is scroll room', section.sectionHeight === '2700px', section.sectionHeight);
    check('stage > 300px', section.stageHeight > 300, String(section.stageHeight));
    check('stage overflow clip', section.stageOverflow, section.stageOverflow);
    check('tilt arrow rendered', section.tiltWidth > 0, String(section.tiltWidth));

    // Keyframes: path-cell rules + 1 tilt rule
    const css = await page.evaluate(() => {
        const sheet = document.getElementById('astar-path-keyframes');
        if (!sheet) return { hasSheet: false, ruleCount: 0, rules: [], visitedCellCount: 0 };
        const ruleNames = Array.from(sheet.sheet.cssRules).map(r => r.name);
        const field = document.getElementById('astar-field');
        const allCells = Array.from(field.querySelectorAll('.path-cell'));
        const visitedCells = allCells.filter(c => c.classList.contains('path-cell--visited'));
        const statefulCells = allCells.filter(c => c.classList.contains('path-cell--visited') || c.classList.contains('path-cell--path'));
        const firstVisited = visitedCells[0];
        const tilt = document.getElementById('astar-tilt');
        return {
            hasSheet: true,
            ruleCount: sheet.sheet.cssRules.length,
            visitedCellCount: visitedCells.length,
            statefulCellCount: statefulCells.length,
            hasTiltRule: ruleNames.includes('astar-tilt-move'),
            cell0Anim: firstVisited ? getComputedStyle(firstVisited).animationName : '',
            tiltAnim: getComputedStyle(tilt).animationName,
        };
    });
    check('astar path keyframes injected', css.hasSheet);
    check('tilt rule present', css.hasTiltRule);
    check('rule count = stateful cells + 1 tilt (path-not-popped cells keyframed too)',
        css.ruleCount === css.statefulCellCount + 1,
        `rules=${css.ruleCount} stateful=${css.statefulCellCount}`);
    check('visited cell animation bound', css.cell0Anim.startsWith('path-cell-'), css.cell0Anim);
    check('tilt animation bound', css.tiltAnim === 'astar-tilt-move', css.tiltAnim);

    // Correctness: A* path is valid, explores fewer cells than BFS would
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
        const astarResult = window.astar(grid, start, end, walls);
        const bfsResult = window.bfs(grid, start, end, walls);
        const wallSet = new Set(walls.map(w => `${w.r},${w.c}`));
        const path = astarResult.path;
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
        const pathNoWalls = path.every(n => !wallSet.has(`${n.r},${n.c}`));
        const reachesEnd = path.length > 0 && path[path.length - 1].r === 19 && path[path.length - 1].c === 19;
        return {
            astarVisited: astarResult.visited.length,
            bfsVisited: bfsResult.visited.length,
            astarPathLen: path.length,
            bfsPathLen: bfsResult.path.length,
            pathValid,
            noDuplicates,
            pathNoWalls,
            reachesEnd,
        };
    });
    check('A* path is valid connected sequence', correctness.pathValid);
    check('A* path has no duplicates', correctness.noDuplicates);
    check('A* path avoids walls', correctness.pathNoWalls);
    check('A* path reaches end cell', correctness.reachesEnd);
    check('A* explores fewer cells than BFS', correctness.astarVisited < correctness.bfsVisited,
        `astar=${correctness.astarVisited} bfs=${correctness.bfsVisited}`);
    check('A* and BFS find same shortest path length', correctness.astarPathLen === correctness.bfsPathLen,
        `astar=${correctness.astarPathLen} bfs=${correctness.bfsPathLen}`);
    check('path length > 0', correctness.astarPathLen > 0, String(correctness.astarPathLen));

    await page.screenshot({ path: '/tmp/sortviz-astar-default.png' });

    check('no console/page errors', errors.length === 0, errors.join(' | '));
    await page.close();

    // --- Motion: visited cell backgrounds change across scroll ---
    const p2 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await p2.goto(FILE, { waitUntil: 'networkidle' });
    await p2.waitForTimeout(1000);
    const motion = await p2.evaluate(() => {
        const s = document.getElementById('section-astar');
        const top = s.offsetTop;
        const visitedCells = Array.from(document.querySelectorAll('#astar-field .path-cell--visited'));
        const sample = visitedCells.slice(5, 25);
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

    // --- Tilt arrow moves across scroll ---
    const tiltMotion = await p2.evaluate(() => {
        const s = document.getElementById('section-astar');
        const top = s.offsetTop;
        const tilt = document.getElementById('astar-tilt');
        return new Promise((resolve) => {
            const transforms = [];
            const opacities = [];
            let k = 0;
            const step = () => {
                window.scrollTo(0, top - 600 + k * 120);
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    transforms.push(getComputedStyle(tilt).transform);
                    opacities.push(parseFloat(getComputedStyle(tilt).opacity));
                    k++;
                    if (k <= 28) step();
                    else resolve({
                        uniqueTransforms: new Set(transforms).size,
                        maxOpacity: Math.max(...opacities),
                    });
                }));
            };
            step();
        });
    });
    check('tilt arrow transform changes across scroll',
        tiltMotion.uniqueTransforms >= 4,
        `${tiltMotion.uniqueTransforms} distinct transforms`);
    check('tilt arrow becomes visible', tiltMotion.maxOpacity > 0.5,
        `max opacity ${tiltMotion.maxOpacity}`);
    await p2.close();

    // --- No overflow desktop + mobile ---
    for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
        const p = await browser.newPage({ viewport: vp });
        await p.goto(FILE, { waitUntil: 'networkidle' });
        await p.waitForTimeout(800);
        await p.locator('#section-astar').scrollIntoViewIfNeeded();
        await p.waitForTimeout(300);
        const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (vp.width === 390) await p.screenshot({ path: '/tmp/sortviz-astar-mobile.png' });
        check(`no horizontal overflow @${vp.width}`, over <= 0, `scrollWidth delta ${over}`);

        if (vp.width === 390) {
            const mob = await p.evaluate(() => {
                const s = document.getElementById('section-astar');
                const field = document.getElementById('astar-field');
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
