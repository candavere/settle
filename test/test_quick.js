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

    // --- Main run: quick section (two-column Act II) ---
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
    });
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

    await page.goto(FILE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.scrollTo(0, document.getElementById('section-quick').offsetTop + 400));
    await page.waitForTimeout(400);

    const section = await page.evaluate(() => {
        const s = document.getElementById('section-quick');
        const stage = s.querySelector('.shard-stage');
        const field = document.getElementById('quick-field');
        const inner = s.querySelector('.section-inner');
        const step = s.querySelector('.narration-step');
        return {
            hasActIIClass: s.classList.contains('algorithm-section--actii'),
            hasQuickClass: s.classList.contains('algorithm-section--quick'),
            innerGrid: getComputedStyle(inner).gridTemplateColumns,
            shardCount: field ? field.querySelectorAll('.quick-shard').length : 0,
            shardClass: field && field.querySelector('.quick-shard') ? field.querySelector('.quick-shard').className : '',
            shardClip: field && field.querySelector('.quick-shard') ? getComputedStyle(field.querySelector('.quick-shard')).clipPath : '',
            stepCount: s.querySelectorAll('.narration-step').length,
            stepPadding: step ? getComputedStyle(step).paddingTop : '',
            descText: s.querySelector('.algorithm-desc').textContent,
            statusText: s.querySelector('.shard-status').textContent,
            statusItalic: getComputedStyle(s.querySelector('.shard-status')).fontStyle,
            sectionHeight: getComputedStyle(s).height,
            stageHeight: parseFloat(getComputedStyle(stage).height),
            crownPresent: !!document.getElementById('quick-crown'),
            boundPresent: !!document.getElementById('quick-bound'),
        };
    });

    check('quick has act-ii class', section.hasActIIClass);
    check('quick section class', section.hasQuickClass);
    check('two-column rail + stage', section.innerGrid.split(' ').length === 2, section.innerGrid);
    check('16 shards built', section.shardCount === 16, String(section.shardCount));
    check('shards use shared class', section.shardClass === 'quick-shard', section.shardClass);
    check('shards are angular', section.shardClip.startsWith('polygon'), section.shardClip);
    check('6 narration steps', section.stepCount === 6, String(section.stepCount));
    check('steps are rail (no card padding)', section.stepPadding === '12px', section.stepPadding);
    check('status line folds in the act', section.statusText.includes('Act II') && section.statusText.includes('crown'), section.statusText);
    check('status line italic', section.statusItalic === 'italic', section.statusItalic);
    check('section is scroll room', section.sectionHeight === '2700px', section.sectionHeight);
    check('stage has height', section.stageHeight > 280, String(section.stageHeight));
    check('crown present', section.crownPresent);
    check('bound present', section.boundPresent);

    // Keyframes: 16 shards + crown + bound
    const css = await page.evaluate(() => {
        const sheet = document.getElementById('quick-keyframes');
        const ruleNames = sheet ? Array.from(sheet.sheet.cssRules).map(r => r.name) : [];
        const field = document.getElementById('quick-field');
        const crown = document.getElementById('quick-crown');
        const bound = document.getElementById('quick-bound');
        const shard0 = field.querySelector('.quick-shard');
        return {
            hasSheet: !!sheet,
            ruleCount: sheet ? sheet.sheet.cssRules.length : 0,
            all16Shards: Array.from({ length: 16 }, (_, i) => ruleNames.includes(`quick-shard-${i}`)).every(Boolean),
            hasCrownRule: ruleNames.includes('quick-crown-move'),
            hasBoundRule: ruleNames.includes('quick-bound-move'),
            shardAnim: getComputedStyle(shard0).animationName,
            crownAnim: getComputedStyle(crown).animationName,
            boundAnim: getComputedStyle(bound).animationName,
        };
    });
    check('quick keyframes injected', css.hasSheet);
    check('keyframes = 16 shards + crown + bound', css.ruleCount === 18, String(css.ruleCount));
    check('shard rules 0..15 present', css.all16Shards);
    check('crown-move rule present', css.hasCrownRule);
    check('bound-move rule present', css.hasBoundRule);
    check('shard animation bound', css.shardAnim === 'quick-shard-0', css.shardAnim);
    check('crown animation bound', css.crownAnim === 'quick-crown-move', css.crownAnim);
    check('bound animation bound', css.boundAnim === 'quick-bound-move', css.boundAnim);

    await page.screenshot({ path: '/tmp/settle-quick-default.png' });

    // Quick steps replay as swaps -> sorted
    const data = await page.evaluate(() => {
        const array = Array.from({ length: 16 }, (_, i) => 280 - i * 15);
        const steps = window.quickSort([...array]);
        const sorted = steps.reduce((acc, s) => {
            if (s.type === 'swap') { const t = acc[s.i]; acc[s.i] = acc[s.j]; acc[s.j] = t; }
            else if (s.type === 'overwrite') acc[s.i] = s.value;
            return acc;
        }, [...array]);
        const types = [...new Set(steps.map(s => s.type))];
        const sortedSteps = steps.filter(s => s.type === 'sorted').length;
        const placeSwap = steps.find(s => s.type === 'swap' && s.j === 15);
        return {
            onlyValidTypes: types.every(t => ['compare', 'swap', 'sorted'].includes(t)),
            arraySorted: JSON.stringify(sorted) === JSON.stringify([...array].sort((a, b) => a - b)),
            sortedCount: sortedSteps,
            firstIsCompare: steps[0].type === 'compare' && steps[0].j === 15,
            hasPivotPlaceSwap: !!placeSwap,
        };
    });
    check('quick emits valid step types', data.onlyValidTypes);
    check('quick produces sorted array', data.arraySorted);
    check('one sorted step per index', data.sortedCount === 16, String(data.sortedCount));
    check('first step compares against pivot', data.firstIsCompare);
    check('has pivot place-swap', data.hasPivotPlaceSwap);

    check('no console/page errors', errors.length === 0, errors.join(' | '));
    await page.close();

    // --- Motion: shard + crown transforms vary as you scroll the section ---
    const p2 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await p2.goto(FILE, { waitUntil: 'networkidle' });
    await p2.waitForTimeout(1000);
    const motions = await p2.evaluate(() => {
        const s = document.getElementById('section-quick');
        const top = s.offsetTop;
        return new Promise((resolve) => {
            const shard = document.querySelector('#section-quick .quick-shard');
            const crown = document.getElementById('quick-crown');
            const seen = new Set();
            const crownSeen = new Set();
            let k = 0;
            const step = () => {
                window.scrollTo(0, top - 600 + k * 120);
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    seen.add(getComputedStyle(shard).transform);
                    crownSeen.add(getComputedStyle(crown).opacity);
                    k++;
                    if (k <= 28) step();
                    else resolve({ shardVariants: seen.size, crownVariants: crownSeen.size });
                }));
            };
            step();
        });
    });
    check('quick shard transform varies across scroll', motions.shardVariants >= 5, `${motions.shardVariants} distinct transforms`);
    check('quick crown animates', motions.crownVariants >= 2, `${motions.crownVariants} distinct opacities`);
    await p2.close();

    // --- No horizontal overflow desktop + mobile ---
    for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
        const p = await browser.newPage({ viewport: vp });
        await p.goto(FILE, { waitUntil: 'networkidle' });
        await p.waitForTimeout(800);
        await p.locator('#section-quick').scrollIntoViewIfNeeded();
        await p.waitForTimeout(300);
        const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (vp.width === 390) await p.screenshot({ path: '/tmp/settle-quick-mobile.png' });
        check(`no horizontal overflow @${vp.width}`, over <= 0, `scrollWidth delta ${over}`);

        if (vp.width === 390) {
            const mob = await p.evaluate(() => {
                const s = document.getElementById('section-quick');
                const field = document.getElementById('quick-field');
                return {
                    cols: getComputedStyle(s.querySelector('.section-inner')).gridTemplateColumns.split(' ').length,
                    shardCount: field.querySelectorAll('.quick-shard').length,
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