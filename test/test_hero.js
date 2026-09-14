const { chromium } = require('playwright');

const FILE = 'file:///Users/amarmehta/Documents/sortviz/index.html';
let failures = 0;

function check(label, ok, detail = '') {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
    if (!ok) failures++;
}

(async () => {
    const browser = await chromium.launch({ headless: true });

    // --- Main run: default motion ---
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
    });
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

    await page.goto(FILE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Narrative visible, hero built
    const init = await page.evaluate(() => ({
        narrativeHidden: document.getElementById('narrative').hidden,
        hasSlab: !!document.getElementById('hero-slab'),
        barCount: document.querySelectorAll('.geode-bar').length,
        status: document.getElementById('hero-status').textContent,
        titleFont: getComputedStyle(document.querySelector('.geode-title')).fontFamily,
        slabGrid: getComputedStyle(document.querySelector('.geode-hero')).gridTemplateColumns,
    }));
    check('narrative visible', init.narrativeHidden === false);
    check('slab present', init.hasSlab);
    check('28 bars built', init.barCount === 28, String(init.barCount));
    check('status RAW', init.status === 'STATE: RAW', init.status);
    check('display font applied', /Unbounded/.test(init.titleFont), init.titleFont);
    check('two-column hero at desktop', init.slabGrid.split(' ').length === 2, init.slabGrid);

    // Raw heights are random-ish (two-col layout) and settled targets are monotonic
    const heights = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.geode-bar')).map((b) => parseFloat(getComputedStyle(b).height))
    );
    const swapped = heights.filter((h, i) => i > 0 && heights[i - 1] > h);
    check('raw heights are not sorted', swapped.length > 0, `unsorted-inversions ${swapped.length}`);

    // Partial hold: 600ms hold should move progress, not finish
    const slabBox = await page.locator('#hero-slab').boundingBox();
    const cx = slabBox.x + slabBox.width / 2;
    const cy = slabBox.y + slabBox.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.waitForTimeout(600);
    const mid = await page.evaluate(() => document.getElementById('hero-slab').style.getPropertyValue('--p'));
    await page.mouse.up();
    await page.waitForTimeout(100);
    const released = await page.evaluate(() => ({
        p: document.getElementById('hero-slab').style.getPropertyValue('--p'),
        done: !document.getElementById('hero-slab').classList.contains('done') && !!document.querySelector('.geode-slab--settled'),
        status: document.getElementById('hero-status').textContent,
    }));
    const midP = parseFloat(mid);
    check('hold moves progress', midP > 0.15 && midP < 0.75, `p=${midP}`);
    check('partial release keeps status RAW', released.status === 'STATE: RAW', released.status);

    // Click to crystallize (tap sends full settle)
    await page.mouse.click(cx, cy);
    await page.waitForTimeout(1400);
    const settled = await page.evaluate(() => ({
        cls: document.getElementById('hero-slab').classList.contains('geode-slab--settled'),
        p: parseFloat(document.getElementById('hero-slab').style.getPropertyValue('--p')),
        status: document.getElementById('hero-status').textContent,
        hintOpacity: getComputedStyle(document.querySelector('.geode-hint')).opacity,
        veinOpacity: getComputedStyle(document.querySelector('.geode-vein')).opacity,
        settledBars: Array.from(document.querySelectorAll('.geode-bar')).filter((b) => b.classList.contains('geode-bar--settled')).length,
    }));
    check('slab settled class', settled.cls);
    check('progress reaches 1', settled.p >= 0.999, `p=${settled.p}`);
    check('status SETTLED', settled.status === 'STATE: SETTLED', settled.status);
    check('hint faded', settled.hintOpacity === '0', settled.hintOpacity);
    check('vein visible', settled.veinOpacity === '1', settled.veinOpacity);
    check('all bars crystallized', settled.settledBars === 28, String(settled.settledBars));

    // Settled heights should be ascending (sorted order)
    const sortedHeights = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.geode-bar')).map((b) => parseFloat(getComputedStyle(b).height))
    );
    const mono = sortedHeights.every((h, i) => i === 0 || sortedHeights[i - 1] <= h + 0.5);
    check('settled heights ascending', mono);

    // Second-stage interaction: geode spread (click after settle)
    const spreadBase = await page.evaluate(() => {
        const slab = document.getElementById('hero-slab');
        return {
            sheets: document.querySelectorAll('.geode-sheet').length,
            hint: getComputedStyle(document.querySelector('.geode-open-hint')).opacity,
            spreadClass: slab.classList.contains('geode-slab--spread'),
        };
    });
    check('4 geode shell sheets built', spreadBase.sheets === 4, String(spreadBase.sheets));
    check('open hint visible after settle', spreadBase.hint === '1', spreadBase.hint);
    check('spread class not yet applied', spreadBase.spreadClass === false);

    // Click spreads: transforms differ per layer (depth), hint hides
    await page.mouse.click(cx, cy);
    await page.waitForTimeout(400);
    const spreadOn = await page.evaluate(() => {
        const slab = document.getElementById('hero-slab');
        const sheets = Array.from(document.querySelectorAll('.geode-sheet'));
        const status = document.getElementById('hero-status').textContent;
        return {
            spreadClass: slab.classList.contains('geode-slab--spread'),
            hint: parseFloat(getComputedStyle(document.querySelector('.geode-open-hint')).opacity),
            status,
            transforms: sheets.map((sh) => getComputedStyle(sh).transform),
            slabOverflow: getComputedStyle(slab).overflow,
        };
    });
    const distinctTransforms = new Set(spreadOn.transforms).size;
    check('click spreads the geode', spreadOn.spreadClass === true);
    check('spread hides open hint', spreadOn.hint < 0.1, `opacity ${spreadOn.hint}`);
    check('spread status reads OPEN', spreadOn.status === 'STATE: SETTLED · OPEN', spreadOn.status);
    check('sheet transforms differ (depth layers)', distinctTransforms >= 3, `${distinctTransforms} distinct`);
    check('spread clipped by slab (overflow hidden)', spreadOn.slabOverflow === 'hidden', spreadOn.slabOverflow);

    // Click again collapses (reversible)
    await page.mouse.click(cx, cy);
    await page.waitForTimeout(200);
    const spreadOff = await page.evaluate(() => {
        const slab = document.getElementById('hero-slab');
        return {
            spreadClass: slab.classList.contains('geode-slab--spread'),
            status: document.getElementById('hero-status').textContent,
        };
    });
    check('click again collapses', spreadOff.spreadClass === false);
    check('status returns to SETTLED', spreadOff.status === 'STATE: SETTLED', spreadOff.status);

    // Spread must never cause page-level overflow (sheets are clipped by the
    // slab's overflow:hidden, so they cannot widen the document).
    await page.mouse.click(cx, cy);
    await page.waitForTimeout(300);
    const spreadOverflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    check('spread causes no page overflow', spreadOverflow <= 0, `delta ${spreadOverflow}`);

    // Keyboard path to spread (Enter after settle) — fresh page
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.locator('#hero-slab').focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1400);
    const kbSettled = await page.evaluate(() => document.getElementById('hero-status').textContent);
    check('Enter crystallizes (first)', kbSettled === 'STATE: SETTLED', kbSettled);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    const kbSpread = await page.evaluate(() => document.getElementById('hero-slab').classList.contains('geode-slab--spread'));
    check('Enter opens the geode (second press)', kbSpread === true);

    // Settled heights should be ascending (sorted order)
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.locator('#hero-slab').focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1400);
    const kb = await page.evaluate(() => document.getElementById('hero-status').textContent);
    check('Enter crystallizes', kb === 'STATE: SETTLED', kb);

    check('no console/page errors', errors.length === 0, errors.join(' | '));
    await page.screenshot({ path: '/tmp/sortviz-hero-default.png' });
    await page.close();

    // --- Reduced motion: static narrative fallback (no dashboard) ---
    const red = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await red.emulateMedia({ reducedMotion: 'reduce' });
    await red.goto(FILE, { waitUntil: 'networkidle' });
    await red.waitForTimeout(800);
    const redState = await red.evaluate(() => ({
        narrativeVisible: !document.getElementById('narrative').hidden &&
            getComputedStyle(document.getElementById('narrative')).display !== 'none',
        staticClass: document.documentElement.classList.contains('no-scroll-animations'),
        settled: document.getElementById('hero-status').textContent,
        stepOpacity: getComputedStyle(document.querySelector('#narration-merge .narration-step')).opacity,
        shardCount: document.querySelectorAll('#bubble-field .bubble-shard').length,
        noDashboard: !document.querySelector('.panel'),
    }));
    check('reduced motion: narrative visible', redState.narrativeVisible === true);
    check('reduced motion: static fallback class', redState.staticClass === true);
    check('reduced motion: hero settled', redState.settled === 'STATE: SETTLED', redState.settled);
    check('reduced motion: narration steps readable', redState.stepOpacity === '1', redState.stepOpacity);
    check('reduced motion: settled shard field', redState.shardCount === 16, String(redState.shardCount));
    check('reduced motion: no dashboard', redState.noDashboard === true);

    // Spread is disabled under reduced motion: even after settle + click the
    // geode stays collapsed and the sheets stay inert.
    const redSpread = await red.evaluate(() => {
        const slab = document.getElementById('hero-slab');
        const sheetTransform = getComputedStyle(document.querySelector('.geode-sheet')).transform;
        slab.click();
        return {
            spreadClass: slab.classList.contains('geode-slab--spread'),
            sheetTransform,
            hint: getComputedStyle(document.querySelector('.geode-open-hint')).opacity,
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
    });
    check('reduced motion: spread stays collapsed', redSpread.spreadClass === false);
    check('reduced motion: sheets inert (no transform)', redSpread.sheetTransform === 'none', redSpread.sheetTransform);
    check('reduced motion: open hint hidden', redSpread.hint === '0', redSpread.hint);
    check('reduced motion: no horizontal overflow', redSpread.overflow <= 0, `delta ${redSpread.overflow}`);
    await red.close();

    // --- Mobile viewport: single column hero ---
    const mob = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await mob.goto(FILE, { waitUntil: 'networkidle' });
    await mob.waitForTimeout(1000);
    const mobGrid = await mob.evaluate(() => ({
        cols: getComputedStyle(document.querySelector('.geode-hero')).gridTemplateColumns.split(' ').length,
        slabH: getComputedStyle(document.getElementById('hero-slab')).height,
    }));
    check('mobile: single column', mobGrid.cols === 1, String(mobGrid.cols));
    await mob.screenshot({ path: '/tmp/sortviz-hero-mobile.png' });

    // Mobile: settle then spread — no overflow, layers contained
    const slabBoxM = await mob.locator('#hero-slab').boundingBox();
    await mob.mouse.click(slabBoxM.x + slabBoxM.width / 2, slabBoxM.y + slabBoxM.height / 2);
    await mob.waitForTimeout(1400);
    await mob.mouse.click(slabBoxM.x + slabBoxM.width / 2, slabBoxM.y + slabBoxM.height / 2);
    await mob.waitForTimeout(400);
    const mobSpread = await mob.evaluate(() => {
        const slab = document.getElementById('hero-slab');
        return {
            spreadClass: slab.classList.contains('geode-slab--spread'),
            clipped: getComputedStyle(slab).overflow === 'hidden',
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
    });
    check('mobile: spread opens', mobSpread.spreadClass === true);
    check('mobile: slab clips sheets (overflow hidden)', mobSpread.clipped === true);
    check('mobile: no horizontal overflow when spread', mobSpread.overflow <= 0, `delta ${mobSpread.overflow}`);
    await mob.close();

    await browser.close();
    console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
    process.exit(failures === 0 ? 0 : 1);
})();