const { chromium } = require('playwright');

const FILE = 'file:///Users/amarmehta/Documents/sortviz/index.html';
let failures = 0;

function check(label, ok, detail = '') {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
    if (!ok) failures++;
}

(async () => {
    const browser = await chromium.launch({ headless: true });

    // --- Main run: bubble section visible mid-scroll ---
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
    });
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

    await page.goto(FILE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    // Scroll the bubble section into view so scroll-linked animations resolve
    await page.locator('#section-bubble').scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);

    const section = await page.evaluate(() => {
        const s = document.getElementById('section-bubble');
        const stage = s.querySelector('.shard-stage');
        const field = document.getElementById('bubble-field');
        const inner = s.querySelector('.section-inner');
        const step = s.querySelector('.narration-step');
        const panel = s.querySelector('.narration-panel');
        return {
            hasBubbleClass: s.classList.contains('algorithm-section--bubble'),
            innerGrid: getComputedStyle(inner).gridTemplateColumns,
            shardCount: field ? field.querySelectorAll('.bubble-shard').length : 0,
            knobCount: s.querySelectorAll('.bubble-knob').length,
            stepCount: s.querySelectorAll('.narration-step').length,
            stepPadding: step ? getComputedStyle(step).paddingTop : '',
            stepColor: step ? getComputedStyle(step).backgroundColor : '',
            descText: s.querySelector('.algorithm-desc').textContent,
            nameGem: getComputedStyle(s.querySelector('.algorithm-name'), '::before').clipPath,
            stageBorder: getComputedStyle(stage).borderRadius,
            stageHeight: parseFloat(getComputedStyle(stage).height),
            fieldInset: getComputedStyle(field).inset,
            shardClip: getComputedStyle(field.querySelector('.bubble-shard')).clipPath,
            statusText: s.querySelector('.shard-status').textContent,
            panelStatic: getComputedStyle(panel).position,
            panelBg: getComputedStyle(s).backgroundColor,
        };
    });

    check('bubble section restyled', section.hasBubbleClass);
    check('two-column rail + stage', section.innerGrid.split(' ').length === 2, section.innerGrid);
    check('16 shards built', section.shardCount === 16, String(section.shardCount));
    check('knob present', section.knobCount === 1);
    check('6 narration steps', section.stepCount === 6, String(section.stepCount));
    check('steps are rail (no card padding)', section.stepPadding === '12px', section.stepPadding);
    check('steps are rail (transparent card)', section.stepColor === 'rgba(0, 0, 0, 0)', section.stepColor);
    check('desc text', section.descText.includes('far edge'), section.descText);
    check('heading gem renders', section.nameGem.startsWith('polygon'), section.nameGem);
    check('stage is geode-styled', section.stageBorder === '3px', section.stageBorder);
    check('stage has height', section.stageHeight > 280, String(section.stageHeight));
    check('field inset', /30px/.test(section.fieldInset), section.fieldInset);
    check('shards are angular', section.shardClip.startsWith('polygon'), section.shardClip);
    check('status line folds in the act', section.statusText.includes('Act I') && section.statusText.includes('far edge'), section.statusText);
    check('panel static inside sticky', section.panelStatic === 'static', section.panelStatic);
    check('shell background', /-?\(|rgb/.test(section.panelBg), section.panelBg);

    // Keyframes: per-shard rules + knob; reveal behavior on scroll
    const css = await page.evaluate(() => {
        const bubbleSheet = document.getElementById('bubble-keyframes');
        const ruleNames = bubbleSheet ? Array.from(bubbleSheet.sheet.cssRules).map(r => r.name) : [];
        return {
            hasBubbleSheet: !!bubbleSheet,
            shardRules: bubbleSheet ? bubbleSheet.sheet.cssRules.length : 0,
            hasKnobMove: ruleNames.includes('bubble-knob-move'),
        };
    });
    check('bubble keyframes injected', css.hasBubbleSheet);
    check('one keyframe per shard + knob', css.shardRules === 17, String(css.shardRules));
    check('knob keyframes defined', css.hasKnobMove);

    // Scroll-driven reveal: knob is bound to its swing timeline and the first
    // narration step rises above its resting 0.45 opacity once in view.
    await page.screenshot({ path: '/tmp/sortviz-bubble-default.png' });
    await page.mouse.move(720, 450);
    await page.mouse.wheel(0, 8000);
    await page.waitForTimeout(500);
    const reveal = await page.evaluate(() => {
        const step = document.querySelector('#section-bubble .narration-step');
        const knob = document.getElementById('bubble-knob');
        return {
            stepOp: parseFloat(getComputedStyle(step).opacity),
            stepAnim: getComputedStyle(step).animationName,
            knobAnim: getComputedStyle(knob).animationName,
        };
    });
    check('knob bound to swing timeline', reveal.knobAnim.includes('bubble-knob-move'), reveal.knobAnim);
    check('narration step reveals on scroll', reveal.stepOp > 0.8, `opacity ${reveal.stepOp}`);

    // Compute the bubble steps directly and make sure the sort contract produces what the viz expects
    const bubbleData = await page.evaluate(() => {
        const array = Array.from({ length: 16 }, (_, i) => 280 - i * 15); // reverse-sorted, deterministic
        const steps = window.bubbleSort([...array]);
        const last = steps[steps.length - 1];
        const compares = steps.filter((s) => s.type === 'compare').length;
        const sorted = steps.filter((s) => s.type === 'sorted').length;
        return {
            arraySorted: JSON.stringify(steps.reduce((acc, s) => {
                if (s.type === 'swap') { const t = acc[s.i]; acc[s.i] = acc[s.j]; acc[s.j] = t; }
                return acc;
            }, [...array])) === JSON.stringify([...array].sort((a, b) => a - b)),
            lastSorted: last && last.type === 'sorted' && last.i === 0,
            compareCount: compares,
            sortedCount: sorted,
        };
    });
    check('bubble sort produces sorted array', bubbleData.arraySorted);
    check('final step marks index 0 sorted', bubbleData.lastSorted);

    // Other sections untouched: quick now uses Act II shard styling, not the
    // old viz-bar prototype
    const untouched = await page.evaluate(() => {
        const s = document.getElementById('section-quick');
        const step = s.querySelector('.narration-step');
        const field = document.getElementById('quick-field');
        const bar = field && field.querySelector('.quick-shard');
        return {
            hasBubbleClass: s.classList.contains('algorithm-section--bubble'),
            stepColor: getComputedStyle(step).backgroundColor,
            stepRadius: getComputedStyle(step).borderRadius,
            barCount: field ? field.querySelectorAll('.quick-shard').length : 0,
            barClip: bar ? getComputedStyle(bar).clipPath : '',
            innerCols: getComputedStyle(s.querySelector('.section-inner')).gridTemplateColumns,
        };
    });
    check('quick section untouched', !untouched.hasBubbleClass);
    check('quick grid still two columns', untouched.innerCols.split(' ').length === 2, untouched.innerCols);
    check('quick steps still rail', untouched.stepColor === 'rgba(0, 0, 0, 0)', untouched.stepColor);
    check('quick steps not cards', untouched.stepRadius === '0px', untouched.stepRadius);
    check('quick bars are shards', untouched.barCount === 16, String(untouched.barCount));
    check('quick bars angular', untouched.barClip.startsWith('polygon'), untouched.barClip);

    check('no console/page errors', errors.length === 0, errors.join(' | '));
    await page.close();

    // --- No horizontal overflow desktop + mobile ---
    for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
        const p = await browser.newPage({ viewport: vp });
        await p.goto(FILE, { waitUntil: 'networkidle' });
        await p.waitForTimeout(800);
        await p.locator('#section-bubble').scrollIntoViewIfNeeded();
        await p.waitForTimeout(300);
        const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (vp.width === 390) await p.screenshot({ path: '/tmp/sortviz-bubble-mobile.png' });
        check(`no horizontal overflow @${vp.width}`, over <= 0, `scrollWidth delta ${over}`);
        await p.close();
    }

    await browser.close();
    console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
    process.exit(failures === 0 ? 0 : 1);
})();