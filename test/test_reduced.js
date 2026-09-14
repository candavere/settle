/* Static fallback verification: without CSS-native scroll animations (or
   with prefers-reduced-motion), the narrative is the only view and renders
   readably — every section laid out in flow, every stage at its settled
   final state. No dashboard, no toggle. */
const { chromium } = require('playwright');

const FILE = 'file:///Users/amarmehta/Documents/sortviz/index.html';
let failures = 0;

function check(label, ok, detail = '') {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
    if (!ok) failures++;
}

(async () => {
    const browser = await chromium.launch({ headless: true });

    for (const motion of ['reduce', 'no-preference']) {
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        const errors = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
        });
        page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
        if (motion === 'reduce') await page.emulateMedia({ reducedMotion: 'reduce' });

        await page.goto(FILE, { waitUntil: 'networkidle' });
        await page.waitForTimeout(800);

        const s = await page.evaluate(() => {
            const narrative = document.getElementById('narrative');
            return {
                narrativeVisible: !narrative.hidden && window.getComputedStyle(narrative).display !== 'none',
                staticClass: document.documentElement.classList.contains('no-scroll-animations'),
                pageHasPanel: !!document.querySelector('.panel'),
                pageHasStage: !!document.querySelector('.stage'),
                pageHasToggle: !!document.querySelector('.view-toggle'),
                settledStatus: document.getElementById('hero-status') ? document.getElementById('hero-status').textContent : '',
                sectionCount: document.querySelectorAll('.algorithm-section').length,
                fields: ['bubble-field', 'selection-field', 'insertion-field', 'merge-field', 'quick-field'].map(id => {
                    const field = document.getElementById(id);
                    return field ? field.children.length : 0;
                }),
                stepOpacities: Array.from(document.querySelectorAll('.narration-step')).map(s =>
                    parseFloat(window.getComputedStyle(s).opacity)
                ),
                innerPosition: getComputedStyle(document.querySelector('#section-bubble .section-inner')).position,
                bfsCells: document.querySelectorAll('#bfs-field .path-cell').length,
                bfsVisited: document.querySelectorAll('#bfs-field .path-cell--visited').length,
                astarPath: document.querySelectorAll('#astar-field .path-cell--path').length,
                dfsPath: document.querySelectorAll('#dfs-field .path-cell--path').length,
                dfsVisited: document.querySelectorAll('#dfs-field .path-cell--visited').length,
                dijkstraPath: document.querySelectorAll('#dijkstra-field .path-cell--path').length,
                dijkstraVisited: document.querySelectorAll('#dijkstra-field .path-cell--visited').length,
            };
        });

        console.log(`=== ${motion} ===`);
        check('narrative visible (only view)', s.narrativeVisible === true);
        check('no dashboard panel', s.pageHasPanel === false);
        check('no dashboard stage', s.pageHasStage === false);
        check('no view toggle', s.pageHasToggle === false);
        check('all 9 sections present', s.sectionCount === 9, String(s.sectionCount));

        if (motion === 'reduce') {
            check('static fallback class applied', s.staticClass === true);
            check('hero settled', s.settledStatus === 'STATE: SETTLED', s.settledStatus);
            check('sections laid out in flow', s.innerPosition === 'static', s.innerPosition);
            check('fields built from sorted arrays', s.fields.length === 5 && s.fields.every(n => n === 16), s.fields.join(','));
            check('narration steps fully visible', s.stepOpacities.length > 0 && s.stepOpacities.every(o => o >= 0.99), s.stepOpacities.join(','));
            check('bfs grid built', s.bfsCells === 400, String(s.bfsCells));
            check('bfs visited wave drawn', s.bfsVisited > 0, String(s.bfsVisited));
            check('astar path drawn', s.astarPath === 37, String(s.astarPath));
            check('dfs grid built', document.querySelectorAll('#dfs-field .path-cell').length === 400, String(document.querySelectorAll('#dfs-field .path-cell').length));
            check('dfs visited drawn', s.dfsVisited > 0, String(s.dfsVisited));
            check('dfs path drawn', s.dfsPath > 0, String(s.dfsPath));
            check('dijkstra grid built', document.querySelectorAll('#dijkstra-field .path-cell').length === 400, String(document.querySelectorAll('#dijkstra-field .path-cell').length));
            check('dijkstra visited drawn', s.dijkstraVisited > 0, String(s.dijkstraVisited));
            check('dijkstra path drawn', s.dijkstraPath > 0, String(s.dijkstraPath));
        } else {
            check('scroll animations kept (no static class)', s.staticClass === false);
            check('hero stays raw in scroll mode', s.settledStatus === 'STATE: RAW', s.settledStatus);
            check('sections keep sticky choreography', s.innerPosition === 'sticky', s.innerPosition);
            check('sort fields built', s.fields.length === 5 && s.fields.every(n => n === 16), s.fields.join(','));
        }

        check('no console/page errors', errors.length === 0, errors.join(' | '));
        await page.close();
    }

    await browser.close();
    process.exit(failures);
})();