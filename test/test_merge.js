const { chromium } = require('playwright');

const { pathToFileURL } = require('node:url');
const path = require('path');
const FILE = pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
let failures = 0;

function check(label, ok, detail = '') {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
    if (!ok) failures++;
}

(async () => {
    const browser = await chromium.launch({ headless: true });

    // --- Main run: merge section (full-bleed Act II) ---
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
    });
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

    await page.goto(FILE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.scrollTo(0, document.getElementById('section-merge').offsetTop + 400));
    await page.waitForTimeout(400);

    const section = await page.evaluate(() => {
        const s = document.getElementById('section-merge');
        const stage = s.querySelector('.shard-stage');
        const field = document.getElementById('merge-field');
        const inner = s.querySelector('.section-inner');
        const step = s.querySelector('.narration-step');
        const panel = s.querySelector('.narration-panel');
        return {
            hasActIIClass: s.classList.contains('algorithm-section--actii'),
            hasMergeClass: s.classList.contains('algorithm-section--merge'),
            innerGrid: getComputedStyle(inner).gridTemplateColumns,
            shardCount: field ? field.querySelectorAll('.merge-shard').length : 0,
            shardClass: field && field.querySelector('.merge-shard') ? field.querySelector('.merge-shard').className : '',
            shardClip: field && field.querySelector('.merge-shard') ? getComputedStyle(field.querySelector('.merge-shard')).clipPath : '',
            stepCount: s.querySelectorAll('.narration-step').length,
            stepDirection: getComputedStyle(s.querySelector('.narration-steps')).flexDirection,
            descText: s.querySelector('.algorithm-desc').textContent,
            statusText: s.querySelector('.shard-status').textContent,
            statusItalic: getComputedStyle(s.querySelector('.shard-status')).fontStyle,
            panelStatic: getComputedStyle(panel).position,
            stageHeight: parseFloat(getComputedStyle(stage).height),
            sectionHeight: getComputedStyle(s).height,
        };
    });

    check('merge has act-ii class', section.hasActIIClass);
    check('merge section class', section.hasMergeClass);
    check('full-bleed single column', section.innerGrid.split(' ').length === 1, section.innerGrid);
    check('16 shards built', section.shardCount === 16, String(section.shardCount));
    check('shards use shared class', section.shardClass === 'merge-shard', section.shardClass);
    check('shards are angular', section.shardClip.startsWith('polygon'), section.shardClip);
    check('6 narration steps', section.stepCount === 6, String(section.stepCount));
    check('narration steps run horizontally', section.stepDirection === 'row', section.stepDirection);
    check('status line folds in the act', section.statusText.includes('Act II') && section.statusText.includes('divide'), section.statusText);
    check('status line italic', section.statusItalic === 'italic', section.statusItalic);
    check('panel static inside sticky', section.panelStatic === 'static', section.panelStatic);
    check('section is scroll room', section.sectionHeight === '2700px', section.sectionHeight);
    check('stage taller than act-i min', section.stageHeight > 330, String(section.stageHeight));

    // Keyframes: 16 shards + 1 suture rule
    const css = await page.evaluate(() => {
        const sheet = document.getElementById('merge-keyframes');
        const ruleNames = sheet ? Array.from(sheet.sheet.cssRules).map(r => r.name) : [];
        const field = document.getElementById('merge-field');
        const suture = document.getElementById('merge-suture');
        const shard0 = field.querySelector('.merge-shard');
        return {
            hasSheet: !!sheet,
            ruleCount: sheet ? sheet.sheet.cssRules.length : 0,
            hasSutureRule: ruleNames.includes('merge-suture-move'),
            all16Shards: Array.from({ length: 16 }, (_, i) => ruleNames.includes(`merge-shard-${i}`)).every(Boolean),
            shardAnim: getComputedStyle(shard0).animationName,
            sutureAnim: getComputedStyle(suture).animationName,
        };
    });
    check('merge keyframes injected', css.hasSheet);
    check('keyframes = 16 shards + suture', css.ruleCount === 17, String(css.ruleCount));
    check('shard rules 0..15 present', css.all16Shards);
    check('suture-move rule present', css.hasSutureRule);
    check('shard animation bound', css.shardAnim === 'merge-shard-0', css.shardAnim);
    check('suture animation bound', css.sutureAnim === 'merge-suture-move', css.sutureAnim);

    await page.screenshot({ path: '/tmp/settle-merge-default.png' });

    // Merge steps replay as overwrites -> sorted
    const data = await page.evaluate(() => {
        const array = Array.from({ length: 16 }, (_, i) => 280 - i * 15);
        const steps = window.mergeSort([...array]);
        const sorted = steps.reduce((acc, s) => {
            if (s.type === 'overwrite') acc[s.i] = s.value;
            else if (s.type === 'swap') { const t = acc[s.i]; acc[s.i] = acc[s.j]; acc[s.j] = t; }
            return acc;
        }, [...array]);
        const types = [...new Set(steps.map(s => s.type))];
        const sortedSteps = steps.filter(s => s.type === 'sorted').length;
        return {
            onlyValidTypes: types.every(t => ['compare', 'overwrite', 'sorted'].includes(t)),
            arraySorted: JSON.stringify(sorted) === JSON.stringify([...array].sort((a, b) => a - b)),
            sortedCount: sortedSteps,
            firstIsCompare: steps[0].type === 'compare' && steps[0].i < steps[0].j,
            hasOverwrites: steps.some(s => s.type === 'overwrite'),
        };
    });
    check('merge emits valid step types', data.onlyValidTypes);
    check('merge produces sorted array', data.arraySorted);
    check('one sorted step per index', data.sortedCount === 16, String(data.sortedCount));
    check('overwrite contract used', data.hasOverwrites);
    check('first step compares halves', data.firstIsCompare);

    check('no console/page errors', errors.length === 0, errors.join(' | '));
    await page.close();

    // --- Motion: shard transforms must vary as you scroll the section ---
    const p2 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await p2.goto(FILE, { waitUntil: 'networkidle' });
    await p2.waitForTimeout(1000);
    const motions = await p2.evaluate(() => {
        const s = document.getElementById('section-merge');
        const top = s.offsetTop;
        return new Promise((resolve) => {
            const shard = document.querySelector('#section-merge .merge-shard');
            const seen = new Set();
            let k = 0;
            const step = () => {
                window.scrollTo(0, top - 600 + k * 120);
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    seen.add(getComputedStyle(shard).transform);
                    k++;
                    if (k <= 28) step();
                    else resolve(seen.size);
                }));
            };
            step();
        });
    });
    check('merge shard transform varies across scroll', motions >= 5, `${motions} distinct transforms`);
    await p2.close();

    // --- No horizontal overflow desktop + mobile ---
    for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
        const p = await browser.newPage({ viewport: vp });
        await p.goto(FILE, { waitUntil: 'networkidle' });
        await p.waitForTimeout(800);
        await p.locator('#section-merge').scrollIntoViewIfNeeded();
        await p.waitForTimeout(300);
        const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (vp.width === 390) await p.screenshot({ path: '/tmp/settle-merge-mobile.png' });
        check(`no horizontal overflow @${vp.width}`, over <= 0, `scrollWidth delta ${over}`);

        if (vp.width === 390) {
            const mob = await p.evaluate(() => {
                const s = document.getElementById('section-merge');
                const field = document.getElementById('merge-field');
                return {
                    cols: getComputedStyle(s.querySelector('.section-inner')).gridTemplateColumns.split(' ').length,
                    shardCount: field.querySelectorAll('.merge-shard').length,
                    stageH: parseFloat(getComputedStyle(s.querySelector('.shard-stage')).height),
                };
            });
            check('mobile: single column', mob.cols === 1, String(mob.cols));
            check('mobile: shards intact', mob.shardCount === 16, String(mob.shardCount));
            check('mobile: stage fits', mob.stageH > 220, String(mob.stageH));
        }
        await p.close();
    }

    await browser.close();
    console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
    process.exit(failures === 0 ? 0 : 1);
})();