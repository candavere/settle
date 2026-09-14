const { chromium } = require('playwright');

const FILE = 'file:///Users/amarmehta/Documents/settle/index.html';
let failures = 0;

function check(label, ok, detail = '') {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
    if (!ok) failures++;
}

(async () => {
    const browser = await chromium.launch({ headless: true });

    // --- Main run: footer presence + structure ---
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
    });
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

    await page.goto(FILE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.scrollTo(0, document.getElementById('narrative-footer').offsetTop + 300));
    await page.waitForTimeout(400);

    const footer = await page.evaluate(() => {
        const f = document.getElementById('narrative-footer');
        const stage = f.querySelector('.footer-stage');
        const copy = f.querySelector('.footer-copy');
        const linksA = Array.from(f.querySelectorAll('.footer-links a'));
        return {
            hasId: !!f,
            veinCount: f.querySelectorAll('.footer-vein').length,
            hasSeed: !!f.querySelector('.footer-seed'),
            hasWordmark: !!f.querySelector('.footer-wordmark'),
            hasTitle: !!f.querySelector('.footer-title'),
            hasSub: !!f.querySelector('.footer-sub'),
            hasStatus: !!f.querySelector('.footer-status'),
            links: linksA.length,
            linkTexts: linksA.map(a => a.textContent),
            linkHref: linksA[0] ? linksA[0].getAttribute('href') : null,
            footerBg: getComputedStyle(f).backgroundColor,
            stagePosition: getComputedStyle(stage).position,
            sectionHeight: getComputedStyle(f).height,
            stageOverflow: getComputedStyle(stage).overflow,
            titleText: f.querySelector('.footer-title').textContent,
            statusText: f.querySelector('.footer-status').textContent,
            seedClip: getComputedStyle(f.querySelector('.footer-seed')).clipPath,
            seedBg: getComputedStyle(f.querySelector('.footer-seed')).backgroundColor,
            copyOpacity: getComputedStyle(copy).opacity,
            linkColor: getComputedStyle(linksA[0]).color,
        };
    });

    check('footer exists', footer.hasId);
    check('6 veins drawn', footer.veinCount === 6, String(footer.veinCount));
    check('citrine seed present', footer.hasSeed);
    check('wordmark present', footer.hasWordmark);
    check('title present', footer.hasTitle);
    check('sub present', footer.hasSub);
    check('status present', footer.hasStatus);
    check('1 footer link (GitHub)', footer.links === 1, footer.linkTexts.join(','));
    check('GitHub link points to candavere/settle',
        footer.linkHref === 'https://github.com/candavere/settle', String(footer.linkHref));
    check('footer on shell background', footer.footerBg === 'rgb(13, 12, 11)', footer.footerBg);
    check('stage is sticky (scroll room)', footer.stagePosition === 'sticky', footer.stagePosition);
    check('footer has 260vh scroll room', footer.sectionHeight === '2340px', footer.sectionHeight);
    check('stage overflow clip (view() timlines anchor to page)', footer.stageOverflow, footer.stageOverflow);
    check('title is the formation line', footer.titleText.includes('Veins converge'), footer.titleText);
    check('status echoes STATE: SETTLED', footer.statusText.includes('SETTLED'), footer.statusText);
    check('seed is citrine diamond', footer.seedClip.includes('polygon') && footer.seedBg === 'rgb(217, 173, 76)',
        `${footer.seedClip} ${footer.seedBg}`);
    check('links are muted', footer.linkColor === 'rgb(160, 154, 141)', footer.linkColor);

    // Keyframes: veins + seed + copy pieces injected and bound
    const css = await page.evaluate(() => {
        const sheet = document.getElementById('footer-keyframes');
        if (!sheet) return { hasSheet: false };
        const ruleNames = Array.from(sheet.sheet.cssRules).map(r => r.name);
        const vein = document.querySelector('.footer-vein');
        const seed = document.querySelector('.footer-seed');
        const links = document.querySelector('.footer-links');
        return {
            hasSheet: true,
            ruleCount: sheet.sheet.cssRules.length,
            veinAnim: getComputedStyle(vein).animationName,
            veinRange: vein.style.animationRange,
            seedAnim: getComputedStyle(seed).animationName,
            copyAnim: getComputedStyle(links).animationName,
            hasVeinRules: ruleNames.filter(n => n.startsWith('footer-vein-')).length,
            hasSeedRule: ruleNames.includes('footer-seed-bloom'),
            hasCopyRule: ruleNames.includes('footer-copy-in'),
        };
    });
    check('footer keyframes injected', css.hasSheet);
    check('6 vein keyframe rules', css.hasVeinRules === 6, String(css.hasVeinRules));
    check('seed bloom rule present', css.hasSeedRule);
    check('copy-in rule present', css.hasCopyRule);
    check('vein animation bound', css.veinAnim.startsWith('footer-vein-'), css.veinAnim);
    check('vein has staggered range', css.veinRange.includes('entry'), css.veinRange);
    check('seed animation bound', css.seedAnim === 'footer-seed-bloom', css.seedAnim);
    check('copy animation bound', css.copyAnim === 'footer-copy-in', css.copyAnim);

    // Motion: veins draw in, seed blooms, copy rises as footer scrolls through
    const motion = await page.evaluate(() => {
        const footer = document.getElementById('narrative-footer');
        const top = footer.offsetTop;
        const vein = document.querySelector('.footer-vein');
        const seed = document.querySelector('.footer-seed');
        const title = document.querySelector('.footer-title');
        const dashSeen = new Set();
        const seedOpacity = [];
        const titleOpacity = [];
        let k = 0;
        return new Promise((resolve) => {
            const step = () => {
                window.scrollTo(0, top - 900 + k * 130);
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    dashSeen.add(getComputedStyle(vein).strokeDashoffset);
                    seedOpacity.push(parseFloat(getComputedStyle(seed).opacity));
                    titleOpacity.push(parseFloat(getComputedStyle(title).opacity));
                    k++;
                    if (k <= 32) step();
                    else resolve({
                        dashVaried: dashSeen.size,
                        seedMax: Math.max(...seedOpacity),
                        titleMax: Math.max(...titleOpacity),
                    });
                }));
            };
            step();
        });
    });
    check('vein stroke-dashoffset varies (draw-in animates)',
        motion.dashVaried >= 3,
        `${motion.dashVaried} distinct dash offsets`);
    check('seed becomes visible', motion.seedMax > 0.9, `max opacity ${motion.seedMax}`);
    check('title rises to full opacity', motion.titleMax > 0.9, `max opacity ${motion.titleMax}`);

    await page.screenshot({ path: '/tmp/settle-footer-converged.png' });

    check('no console/page errors', errors.length === 0, errors.join(' | '));
    await page.close();

    // --- No overflow desktop + mobile; mobile shows settled static footer ---
    for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
        const p = await browser.newPage({ viewport: vp });
        await p.goto(FILE, { waitUntil: 'networkidle' });
        await p.waitForTimeout(800);
        await p.locator('#narrative-footer').scrollIntoViewIfNeeded();
        await p.waitForTimeout(300);
        const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        check(`no horizontal overflow @${vp.width}`, over <= 0, `scrollWidth delta ${over}`);

        if (vp.width === 390) {
            const mob = await p.evaluate(() => {
                const f = document.getElementById('narrative-footer');
                const stage = f.querySelector('.footer-stage');
                return {
                    footerHeight: getComputedStyle(f).height,
                    stagePosition: getComputedStyle(stage).position,
                    titleOpacity: getComputedStyle(f.querySelector('.footer-title')).opacity,
                    seedOpacity: getComputedStyle(f.querySelector('.footer-seed')).opacity,
                    titleFontSize: parseFloat(getComputedStyle(f.querySelector('.footer-title')).fontSize),
                };
            });
            check('mobile: footer is static block', mob.stagePosition === 'static', mob.stagePosition);
            check('mobile: copy shows settled (no animation trapping)', mob.titleOpacity === '1', mob.titleOpacity);
            check('mobile: seed visible', mob.seedOpacity === '1', mob.seedOpacity);
            check('mobile: title readable', mob.titleFontSize >= 24, `font-size ${mob.titleFontSize}px`);
            await p.screenshot({ path: '/tmp/settle-footer-mobile-settled.png' });
        }
        await p.close();
    }

    await browser.close();
    console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
    process.exit(failures === 0 ? 0 : 1);
})();