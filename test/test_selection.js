const { chromium } = require('playwright');

const FILE = 'file:///Users/amarmehta/Documents/settle/index.html';
let failures = 0;

function check(label, ok, detail = '') {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
    if (!ok) failures++;
}

(async () => {
    const browser = await chromium.launch({ headless: true });

    // --- Main run: selection section visible mid-scroll ---
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
    });
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

    await page.goto(FILE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    // Pin the section so its scroll-linked animations resolve
    await page.evaluate(() => window.scrollTo(0, document.getElementById('section-selection').offsetTop + 400));
    await page.waitForTimeout(400);

    const section = await page.evaluate(() => {
        const s = document.getElementById('section-selection');
        const stage = s.querySelector('.shard-stage');
        const field = document.getElementById('selection-field');
        const pin = document.getElementById('selection-minpin');
        const inner = s.querySelector('.section-inner');
        const step = s.querySelector('.narration-step');
        const panel = s.querySelector('.narration-panel');
        return {
            hasActIClass: s.classList.contains('algorithm-section--act-i'),
            hasSelectionClass: s.classList.contains('algorithm-section--selection'),
            innerGrid: getComputedStyle(inner).gridTemplateColumns,
            shardCount: field ? field.querySelectorAll('.selection-shard').length : 0,
            shardClass: field && field.querySelector('.selection-shard') ? field.querySelector('.selection-shard').className : '',
            shardClip: field && field.querySelector('.selection-shard') ? getComputedStyle(field.querySelector('.selection-shard')).clipPath : '',
            minpinCount: s.querySelectorAll('.selection-minpin').length,
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

    check('selection has act-i class', section.hasActIClass);
    check('selection section class', section.hasSelectionClass);
    check('two-column rail + stage', section.innerGrid.split(' ').length === 2, section.innerGrid);
    check('16 shards built', section.shardCount === 16, String(section.shardCount));
    check('shards use shared class', section.shardClass === 'selection-shard', section.shardClass);
    check('shards are angular', section.shardClip.startsWith('polygon'), section.shardClip);
    check('minpin present', section.minpinCount === 1);
    check('6 narration steps', section.stepCount === 6, String(section.stepCount));
    check('steps are rail (no card padding)', section.stepPadding === '12px', section.stepPadding);
    check('status line folds in the act', section.statusText.includes('Act I') && section.statusText.includes('minimum'), section.statusText);
    check('status line italic', section.statusItalic === 'italic', section.statusItalic);
    check('panel static inside sticky', section.panelStatic === 'static', section.panelStatic);
    check('section is scroll room', section.sectionHeight === '2700px', section.sectionHeight);
    check('stage has height', section.stageHeight > 280, String(section.stageHeight));

    // Keyframes: per-shard rules + pin; reveal behavior on scroll
    const css = await page.evaluate(() => {
        const sheet = document.getElementById('selection-keyframes');
        const ruleNames = sheet ? Array.from(sheet.sheet.cssRules).map(r => r.name) : [];
        return {
            hasSheet: !!sheet,
            ruleCount: sheet ? sheet.sheet.cssRules.length : 0,
            hasPinMove: ruleNames.includes('selection-minpin-move'),
            pinAnim: getComputedStyle(document.getElementById('selection-minpin')).animationName,
            stepAnim: getComputedStyle(document.querySelector('#section-selection .narration-step')).animationName,
            stepOp: parseFloat(getComputedStyle(document.querySelector('#section-selection .narration-step')).opacity),
        };
    });
    check('selection keyframes injected', css.hasSheet);
    check('one keyframe per shard + pin', css.ruleCount === 17, String(css.ruleCount));
    check('pin keyframes defined', css.hasPinMove);
    check('pin bound to fly timeline', css.pinAnim.includes('selection-minpin-move'), css.pinAnim);
    check('narration step reveals on scroll', css.stepOp > 0.8, `opacity ${css.stepOp}`);

    await page.screenshot({ path: '/tmp/settle-selection-default.png' });

    // Compute the selection steps and make sure the sort contract is sound
    const data = await page.evaluate(() => {
        const array = Array.from({ length: 16 }, (_, i) => 280 - i * 15); // reverse-sorted
        const steps = window.selectionSort([...array]);
        const sorted = steps.reduce((acc, s) => {
            if (s.type === 'swap') { const t = acc[s.i]; acc[s.i] = acc[s.j]; acc[s.j] = t; }
            return acc;
        }, [...array]);
        const last = steps[steps.length - 1];
        return {
            arraySorted: JSON.stringify(sorted) === JSON.stringify([...array].sort((a, b) => a - b)),
            lastSorted: last && last.type === 'sorted' && last.i === 15,
            firstNext: steps[0].type === 'compare' && steps[0].j === 1,
        };
    });
    check('selection produces sorted array', data.arraySorted);
    check('final step marks last index sorted', data.lastSorted);
    check('first step scans from index 1', data.firstNext);

    check('no console/page errors', errors.length === 0, errors.join(' | '));
    await page.close();

    // --- No horizontal overflow desktop + mobile ---
    for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
        const p = await browser.newPage({ viewport: vp });
        await p.goto(FILE, { waitUntil: 'networkidle' });
        await p.waitForTimeout(800);
        await p.locator('#section-selection').scrollIntoViewIfNeeded();
        await p.waitForTimeout(300);
        const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (vp.width === 390) await p.screenshot({ path: '/tmp/settle-selection-mobile.png' });
        check(`no horizontal overflow @${vp.width}`, over <= 0, `scrollWidth delta ${over}`);

        if (vp.width === 390) {
            const mob = await p.evaluate(() => {
                const s = document.getElementById('section-selection');
                const field = document.getElementById('selection-field');
                return {
                    cols: getComputedStyle(s.querySelector('.section-inner')).gridTemplateColumns.split(' ').length,
                    shardCount: field.querySelectorAll('.selection-shard').length,
                    stageH: parseFloat(getComputedStyle(s.querySelector('.shard-stage')).height),
                    minpinCount: s.querySelectorAll('.selection-minpin').length,
                };
            });
            check('mobile: single column', mob.cols === 1, String(mob.cols));
            check('mobile: shards intact', mob.shardCount === 16, String(mob.shardCount));
            check('mobile: stage fits', mob.stageH > 220, String(mob.stageH));
            check('mobile: pin intact', mob.minpinCount === 1);
        }
        await p.close();
    }

    await browser.close();
    console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
    process.exit(failures === 0 ? 0 : 1);
})();