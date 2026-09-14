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

    // --- Main run: insertion section visible mid-scroll ---
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
    });
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

    await page.goto(FILE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.scrollTo(0, document.getElementById('section-insertion').offsetTop + 400));
    await page.waitForTimeout(400);

    const section = await page.evaluate(() => {
        const s = document.getElementById('section-insertion');
        const stage = s.querySelector('.shard-stage');
        const field = document.getElementById('insertion-field');
        const inner = s.querySelector('.section-inner');
        const step = s.querySelector('.narration-step');
        const panel = s.querySelector('.narration-panel');
        return {
            hasActIClass: s.classList.contains('algorithm-section--act-i'),
            hasInsertionClass: s.classList.contains('algorithm-section--insertion'),
            innerGrid: getComputedStyle(inner).gridTemplateColumns,
            shardCount: field ? field.querySelectorAll('.insertion-shard').length : 0,
            shardClass: field && field.querySelector('.insertion-shard') ? field.querySelector('.insertion-shard').className : '',
            shardClip: field && field.querySelector('.insertion-shard') ? getComputedStyle(field.querySelector('.insertion-shard')).clipPath : '',
            stepCount: s.querySelectorAll('.narration-step').length,
            stepPadding: step ? getComputedStyle(step).paddingTop : '',
            descText: s.querySelector('.algorithm-desc').textContent,
            statusText: s.querySelector('.shard-status').textContent,
            statusItalic: getComputedStyle(s.querySelector('.shard-status')).fontStyle,
            panelStatic: getComputedStyle(panel).position,
            stageHeight: parseFloat(getComputedStyle(stage).height),
            sectionHeight: getComputedStyle(s).height,
        };
    });

    check('insertion has act-i class', section.hasActIClass);
    check('insertion section class', section.hasInsertionClass);
    check('two-column rail + stage', section.innerGrid.split(' ').length === 2, section.innerGrid);
    check('16 shards built', section.shardCount === 16, String(section.shardCount));
    check('shards use shared class', section.shardClass === 'insertion-shard', section.shardClass);
    check('shards are angular', section.shardClip.startsWith('polygon'), section.shardClip);
    check('6 narration steps', section.stepCount === 6, String(section.stepCount));
    check('steps are rail (no card padding)', section.stepPadding === '12px', section.stepPadding);
    check('status line folds in the act', section.statusText.includes('Act I') && section.statusText.includes('key'), section.statusText);
    check('status line italic', section.statusItalic === 'italic', section.statusItalic);
    check('panel static inside sticky', section.panelStatic === 'static', section.panelStatic);
    check('section is scroll room', section.sectionHeight === '2700px', section.sectionHeight);
    check('stage has height', section.stageHeight > 280, String(section.stageHeight));

    // Keyframes: per-shard rules only (insertion has no pin)
    const css = await page.evaluate(() => {
        const sheet = document.getElementById('insertion-keyframes');
        const ruleNames = sheet ? Array.from(sheet.sheet.cssRules).map(r => r.name) : [];
        const first = document.querySelector('#section-insertion .selection-minpin');
        return {
            hasSheet: !!sheet,
            ruleCount: sheet ? sheet.sheet.cssRules.length : 0,
            hasMinpinRule: ruleNames.includes('selection-minpin-move'),
            stepAnim: getComputedStyle(document.querySelector('#section-insertion .narration-step')).animationName,
            stepOp: parseFloat(getComputedStyle(document.querySelector('#section-insertion .narration-step')).opacity),
            noPinInSection: !first,
        };
    });
    check('insertion keyframes injected', css.hasSheet);
    check('one keyframe per shard, no pin', css.ruleCount === 16, String(css.ruleCount));
    check('no pin rule in sheet', !css.hasMinpinRule);
    check('no pin element in section', css.noPinInSection);
    check('narration step reveals on scroll', css.stepOp > 0.8, `opacity ${css.stepOp}`);

    await page.screenshot({ path: '/tmp/settle-insertion-default.png' });

    // Compute the insertion steps and verify contract + prefix-growth semantics
    const data = await page.evaluate(() => {
        const array = Array.from({ length: 16 }, (_, i) => 280 - i * 15); // reverse-sorted
        const steps = window.insertionSort([...array]);
        const sorted = steps.reduce((acc, s) => {
            if (s.type === 'swap') { const t = acc[s.i]; acc[s.i] = acc[s.j]; acc[s.j] = t; }
            return acc;
        }, [...array]);
        const headers = steps.filter(s => s.type === 'sorted').length;
        const firstSwap = steps.find(s => s.type === 'swap');
        return {
            arraySorted: JSON.stringify(sorted) === JSON.stringify([...array].sort((a, b) => a - b)),
            sortedCount: headers,
            firstSwapPair: firstSwap ? firstSwap.i + 1 === firstSwap.j : false,
            startsSorted: steps[0].type === 'sorted' && steps[0].i === 0,
        };
    });
    check('insertion produces sorted array', data.arraySorted);
    check('one sorted step per index', data.sortedCount === 16, String(data.sortedCount));
    check('swaps are adjacent pairs', data.firstSwapPair);
    check('first step seeds index 0', data.startsSorted);

    check('no console/page errors', errors.length === 0, errors.join(' | '));
    await page.close();

    // --- No horizontal overflow desktop + mobile ---
    for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
        const p = await browser.newPage({ viewport: vp });
        await p.goto(FILE, { waitUntil: 'networkidle' });
        await p.waitForTimeout(800);
        await p.locator('#section-insertion').scrollIntoViewIfNeeded();
        await p.waitForTimeout(300);
        const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (vp.width === 390) await p.screenshot({ path: '/tmp/settle-insertion-mobile.png' });
        check(`no horizontal overflow @${vp.width}`, over <= 0, `scrollWidth delta ${over}`);

        if (vp.width === 390) {
            const mob = await p.evaluate(() => {
                const s = document.getElementById('section-insertion');
                const field = document.getElementById('insertion-field');
                return {
                    cols: getComputedStyle(s.querySelector('.section-inner')).gridTemplateColumns.split(' ').length,
                    shardCount: field.querySelectorAll('.insertion-shard').length,
                    stageH: parseFloat(getComputedStyle(s.querySelector('.shard-stage')).height),
                    railH: parseFloat(getComputedStyle(s.querySelector('.narration-panel')).height),
                };
            });
            check('mobile: single column', mob.cols === 1, String(mob.cols));
            check('mobile: shards intact', mob.shardCount === 16, String(mob.shardCount));
            check('mobile: stage fits', mob.stageH > 220, String(mob.stageH));
            check('mobile: rail not truncated', mob.railH > 500, String(mob.railH));
        }
        await p.close();
    }

    await browser.close();
    console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
    process.exit(failures === 0 ? 0 : 1);
})();