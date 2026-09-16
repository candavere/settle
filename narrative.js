/**
 * settle Narrative Controller
 * Handles scroll-driven animations for algorithm visualizations
 */

const NarrativeState = {
    initialized: false,
    scrollSupported: false,
    reducedMotion: false,
    currentAlgorithm: null,
    narrationObservers: new Map(),
    playback: new Map(),
};

function generateHeroArray(size = 12) {
    const arr = [];
    for (let i = 0; i < size; i++) {
        arr.push(Math.floor(Math.random() * 280) + 20);
    }
    return arr;
}

const HERO_CONFIG = {
    bars: 28,
    holdMs: 1500,
    settleMs: 900,
};

const BUBBLE_CONFIG = {
    bars: 16,
};

const hero = {
    slab: null,
    status: null,
    bars: [],
    p: 0,
    raf: null,
    done: false,
    holding: false,
    lastTs: 0,
    pressAt: -1e9,
    suppressClick: false,
    spread: false,
};

function makeHeroValues() {
    const n = HERO_CONFIG.bars;
    const h0 = [];
    const h1 = [];
    for (let i = 0; i < n; i++) {
        h0.push(0.14 + Math.random() * 0.76);
    }
    for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        h1.push(0.06 + Math.pow(t, 1.28) * 0.84);
    }
    return { h0, h1 };
}

function applyHeroProgress() {
    hero.slab.style.setProperty('--p', hero.p);
    const n = hero.bars.length;
    hero.bars.forEach((bar, i) => {
        const lockAt = ((i + 1) / n) * 0.85;
        bar.classList.toggle('geode-bar--settled', hero.p >= lockAt);
    });
    if (hero.p >= 1 && !hero.done) finishHero();
}

function heroStep(ts) {
    if (!hero.holding || hero.done) {
        hero.raf = null;
        return;
    }
    const dt = ts - hero.lastTs;
    hero.lastTs = ts;
    hero.p = Math.min(1, hero.p + dt / HERO_CONFIG.holdMs);
    applyHeroProgress();
    hero.raf = hero.p < 1 ? requestAnimationFrame(heroStep) : null;
}

function startHeroHold() {
    hero.holding = true;
    hero.lastTs = performance.now();
    if (!hero.raf) hero.raf = requestAnimationFrame(heroStep);
}

function endHeroHold() {
    hero.holding = false;
    if (hero.raf) {
        cancelAnimationFrame(hero.raf);
        hero.raf = null;
    }
}

function settleHero() {
    if (hero.done) return;
    const startP = hero.p;
    if (startP >= 1) {
        finishHero();
        return;
    }
    const startTs = performance.now();
    const ease = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
    const step = (ts) => {
        const t = Math.min(1, (ts - startTs) / HERO_CONFIG.settleMs);
        hero.p = startP + (1 - startP) * ease(t);
        applyHeroProgress();
        hero.raf = t < 1 ? requestAnimationFrame(step) : null;
    };
    hero.raf = requestAnimationFrame(step);
}

function finishHero() {
    if (hero.done) return;
    hero.done = true;
    hero.slab.classList.add('geode-slab--settled');
    hero.slab.setAttribute('aria-label', 'Array of values. Settled into sorted order. Click or press Enter to open the geode.');
    hero.status.textContent = 'STATE: SETTLED';
    const btn = document.getElementById('btn-crystallize');
    if (btn) {
        btn.setAttribute('aria-disabled', 'true');
        btn.textContent = 'Crystallized';
    }
}

/* Second-stage interaction: once the slab has settled, click/tap/Enter/Space
   peels the geode open (spread) and back. Reduced motion keeps it collapsed. */
function toggleGeodeSpread() {
    if (NarrativeState.reducedMotion) return;
    if (!hero.done) return;
    hero.spread = !hero.spread;
    hero.slab.classList.toggle('geode-slab--spread', hero.spread);
    hero.status.textContent = hero.spread ? 'STATE: SETTLED · OPEN' : 'STATE: SETTLED';
}

function initializeGeodeHero() {
    const slab = document.getElementById('hero-slab');
    const field = document.getElementById('hero-field');
    const status = document.getElementById('hero-status');
    if (!slab || !field || !status) return;

    const { h0, h1 } = makeHeroValues();
    hero.slab = slab;
    hero.status = status;

    field.innerHTML = '';
    hero.bars = [];
    h0.forEach((value, i) => {
        const bar = document.createElement('i');
        bar.className = 'geode-bar';
        bar.style.setProperty('--h0', (value * 100).toFixed(2));
        bar.style.setProperty('--h1', (h1[i] * 100).toFixed(2));
        bar.style.setProperty('--tilt', (Math.random() * 6 - 3).toFixed(2));
        hero.bars.push(bar);
        field.appendChild(bar);
    });
    slab.style.setProperty('--p', 0);

    const btn = document.getElementById('btn-crystallize');
    if (btn) btn.addEventListener('click', () => settleHero());

    slab.addEventListener('pointerdown', (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        hero.pressAt = Date.now();
        hero.suppressClick = false;
        if (hero.done) return;
        startHeroHold();
    });

    window.addEventListener('pointerup', (e) => {
        if (Date.now() - hero.pressAt > 300) hero.suppressClick = true;
        endHeroHold();
    });

    window.addEventListener('pointercancel', () => endHeroHold());
    slab.addEventListener('mouseleave', () => endHeroHold());

    slab.addEventListener('click', () => {
        if (hero.suppressClick) return;
        if (hero.done) {
            toggleGeodeSpread();
            return;
        }
        settleHero();
    });

    slab.addEventListener('keydown', (e) => {
        if (hero.done) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleGeodeSpread();
            }
            return;
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            settleHero();
        } else if (e.key === ' ') {
            e.preventDefault();
            hero.pressAt = Date.now();
            startHeroHold();
        }
    });

    slab.addEventListener('keyup', (e) => {
        if (e.key === ' ') endHeroHold();
    });
}

function pct(value) {
    return value.toFixed(2);
}

/* Shared shard-state vocabulary for the Act I sections (bubble, selection,
   insertion). Colour + brightness + geometry change together so a state is
   never read from one channel alone. */
const ACTI_STATE = {
    bevel: {
        /* Symmetric bevel: both top corners trimmed by the same %, so every
           bar's top edge is level left-to-right. All states share one value
           so the visible top of any bar terminates at the same horizontal
           line for the same value in any state. */
        base: 'polygon(0 100%, 0 4%, 100% 4%, 100% 100%)',
        compare: 'polygon(0 100%, 0 4%, 100% 4%, 100% 100%)',
        swap: 'polygon(0 100%, 0 4%, 100% 4%, 100% 100%)',
        settled: 'polygon(0 100%, 0 4%, 100% 4%, 100% 100%)',
    },
    bg: {
        base: 'linear-gradient(to top, #262019, #4a4033)',
        compare: 'linear-gradient(to top, #6d4e20, #c09335)',
        swap: 'linear-gradient(to top, #805a1e, #e2ae47)',
        settled: 'linear-gradient(to top, #333a38, #5a655f)',
    },
};

const ACT_I_CONFIG = {
    bars: 16,
};

/* Measure the shard field so choreography can translate bars in real pixels
   (one slot = one bar width + its gap) and position the pin in stage
   coordinates. */
function measureShardField(field, stage) {
    const fRect = field.getBoundingClientRect();
    const sRect = stage.getBoundingClientRect();
    const n = field.children.length;
    const gap = parseFloat(getComputedStyle(field).gap) || 3;
    const slot = (fRect.width - gap * (n - 1)) / n + gap;
    return { slot, gap, n, fieldLeft: fRect.left - sRect.left, fieldW: fRect.width };
}

function buildActIShardField(field, array, shardClass) {
    field.innerHTML = '';
    const maxVal = Math.max(...array);
    array.forEach(value => {
        const bar = document.createElement('i');
        bar.className = shardClass;
        /* Height is value/max directly: the symmetric bevel trims both top
           corners equally, so no oversize compensation is needed and the
           painted top lands on the value line the section narrates. */
        bar.style.height = `${(value / maxVal) * 100}%`;
        field.appendChild(bar);
    });
}

function injectActIStyle(id, css) {
    let sheet = document.getElementById(id);
    if (!sheet) {
        sheet = document.createElement('style');
        sheet.id = id;
        document.head.appendChild(sheet);
    }
    sheet.textContent = css;
    return sheet;
}

function generateBubbleKeyframes(array, steps, field, stage) {
    const n = array.length;
    const spread = 100 / steps.length;
    const knobWidth = 12.5;
    const knobRange = 100 - knobWidth;
    const bevel = ACTI_STATE.bevel;
    const bg = ACTI_STATE.bg;
    const shardFrags = new Map();
    let knobFrags = '';

    const slotMath = field && stage ? shardSlotMath(field, stage) : null;
    const domP = array.map((_, i) => i);
    const xPx = new Array(n).fill(0);

    const add = (dom, snippet) => {
        if (!shardFrags.has(dom)) shardFrags.set(dom, []);
        shardFrags.get(dom).push(snippet);
    };

    steps.forEach((step, si) => {
        const p = (si / steps.length) * 100;
        const next = Math.min(100, p + spread);

        if (step.type === 'compare') {
            [step.i, step.j].forEach(pos => {
                const dom = domP[pos];
                add(dom,
                    `${pct(p)}% { clip-path: ${bevel.compare}; background: ${bg.compare}; transform: translateX(${pct(xPx[dom])}px) translateY(-3px) scaleY(1.03); } ` +
                    `${pct(next)}% { clip-path: ${bevel.base}; background: ${bg.base}; transform: translateX(${pct(xPx[dom])}px) translateY(0px) scaleY(1); }`
                );
            });
            knobFrags += `${pct(p)}% { opacity: 1; left: ${pct((step.j / (n - 2)) * knobRange)}%; } `;
        } else if (step.type === 'swap') {
            const hold = Math.min(100, p + spread * 1.7);
            const dip = p + (hold - p) * 0.5;
            const da = domP[step.i];
            const db = domP[step.j];
            const aX0 = xPx[da];
            const bX0 = xPx[db];

            [da, db].forEach(dom => add(dom,
                `${pct(p)}% { clip-path: ${bevel.swap}; background: ${bg.swap}; transform: translateX(${pct(xPx[dom])}px) translateY(-6px) scaleY(1.08); z-index: 3; } `
            ));

            if (slotMath) {
                const aX1 = aX0 + slotMath.slot;
                const bX1 = bX0 - slotMath.slot;
                const aMid = (aX0 + aX1) / 2;
                const bMid = (bX0 + bX1) / 2;
                add(da,
                    `${pct(dip)}% { clip-path: ${bevel.swap}; background: ${bg.swap}; transform: translateX(${pct(aMid)}px) translateY(-6px) scaleY(1.05); z-index: 3; } ` +
                    `${pct(hold)}% { clip-path: ${bevel.base}; background: ${bg.base}; transform: translateX(${pct(aX1)}px) translateY(0px) scaleY(1); z-index: 1; } `
                );
                add(db,
                    `${pct(dip)}% { clip-path: ${bevel.swap}; background: ${bg.swap}; transform: translateX(${pct(bMid)}px) translateY(-6px) scaleY(1.05); z-index: 3; } ` +
                    `${pct(hold)}% { clip-path: ${bevel.base}; background: ${bg.base}; transform: translateX(${pct(bX1)}px) translateY(0px) scaleY(1); z-index: 1; } `
                );
                xPx[da] = aX1;
                xPx[db] = bX1;
                const tmp = domP[step.i];
                domP[step.i] = domP[step.j];
                domP[step.j] = tmp;
            } else {
                [da, db].forEach(dom => add(dom,
                    `${pct(hold)}% { clip-path: ${bevel.base}; background: ${bg.base}; transform: translateX(${pct(xPx[dom])}px) translateY(0px) scaleY(1); z-index: 1; } `
                ));
            }

            knobFrags += `${pct(p)}% { opacity: 1; left: ${pct((step.j / (n - 2)) * knobRange)}%; } `;
        } else if (step.type === 'sorted') {
            const dom = domP[step.i];
            add(dom,
                `${pct(p)}% { clip-path: ${bevel.settled}; background: ${bg.settled}; transform: translateX(${pct(xPx[dom])}px); } `
            );
        }
    });

    const final = steps[steps.length - 1];
    if (final && final.type === 'sorted') {
        const glintP = ((steps.length - 1) / steps.length) * 100;
        add(domP[final.i],
            `${pct(glintP + 0.2)}% { background: var(--face); } ` +
            `${pct(Math.min(100, glintP + 1.6))}% { background: ${bg.settled}; } `
        );
    }

    let css = '';
    for (let i = 0; i < n; i++) {
        const frags = shardFrags.get(i) || [];
        css += `@keyframes bubble-shard-${i} { ` +
            `0% { clip-path: ${bevel.base}; background: ${bg.base}; transform: translateX(0px) translateY(0px) scaleY(1); } ` +
            `${frags.join('')}` +
            `100% { clip-path: ${bevel.settled}; background: ${bg.settled}; transform: translateX(${pct(xPx[i])}px) translateY(0px) scaleY(1); } } `;
    }
    css += `@keyframes bubble-knob-move { 0% { opacity: 0.25; left: 0%; } ` +
        `${knobFrags}100% { opacity: 0.25; left: ${knobRange}%; } }`;
    return css;
}

function setupBubbleSortAnimations() {
    const section = document.querySelector('.algorithm-section--bubble');
    const stage = section && section.querySelector('.shard-stage');
    const field = document.getElementById('bubble-field');
    const knob = document.getElementById('bubble-knob');
    if (!stage || !field || !knob) return;

    const array = generateHeroArray(BUBBLE_CONFIG.bars);
    const steps = window.bubbleSort([...array]);

    buildActIShardField(field, array, 'bubble-shard');
    const css = generateBubbleKeyframes(array, steps, field, stage);
    injectActIStyle('bubble-keyframes', css);

    registerClickToPlay({
        algorithm: 'bubble',
        section,
        stage,
        field,
        dynamic: 'sort',
        array,
        steps,
        shardClass: 'bubble-shard',
        overlays: [{ id: 'bubble-knob', rule: 'bubble-knob-move' }],
    });

    if (!NarrativeState.scrollSupported) return;

    const range = buildScrollRange(section);

    field.querySelectorAll('.bubble-shard').forEach((bar, i) => {
        bar.style.animation = `bubble-shard-${i} auto linear`;
        bar.style.animationTimeline = 'scroll(root)';
        if (range) bar.style.animationRange = range.full;
        bar.style.animationFillMode = 'both';
    });

    knob.style.animation = 'bubble-knob-move auto linear';
    knob.style.animationTimeline = 'scroll(root)';
    if (range) knob.style.animationRange = range.full;
    knob.style.animationFillMode = 'both';
}

/* The scroll-fraction range for a section: the animation plays from the
   moment the section's top enters the viewport bottom (secTop - V) to the
   moment the section's bottom reaches the viewport bottom
   (secTop + secH - V, measured from the real laid-out height so the
   collapsed ≤1024px sections animate across their full height),
   so the array is fully sorted right when the section leaves the viewport.

   On the collapsed (≤1024px) layout .section-inner is not sticky, so a
   sorting section's field scrolls off the top of the viewport before the
   section bottom reaches it. There the range ends the moment the field's
   top reaches the viewport top (fieldTop === 0) — the last frame where the
   field is still fully visible — so the settled array is what the user sees
   as the field leaves. Desktop's sticky .section-inner keeps the field on
   screen through the whole range, so it keeps the section-exit end. */
function buildScrollRange(sectionEl) {
    const rect = sectionEl.getBoundingClientRect();
    const secTop = rect.top + window.scrollY;
    const V = window.innerHeight;
    const maxScroll = document.documentElement.scrollHeight - V;
    if (maxScroll <= 0) return null;
    const secH = rect.height;
    const start = Math.max(0, (secTop - V)) / maxScroll;

    let endScrollY = secTop + secH - V;
    const field = sectionEl.querySelector('.shard-field');
    const collapsed = window.matchMedia('(max-width: 1024px)').matches;
    if (collapsed && field) {
        const fieldTopDoc = field.getBoundingClientRect().top + window.scrollY;
        endScrollY = Math.min(endScrollY, fieldTopDoc);
    }

    const end = Math.min(1, endScrollY / maxScroll);
    if (end - start < 0.001) return null;
    return {
        full: `${(start * 100).toFixed(4)}% ${(end * 100).toFixed(4)}%`,
        start,
        end,
        span: end - start,
        step: (i, n) => {
            const a = start + (i / n) * (end - start);
            const b = start + ((i + 1) / n) * (end - start);
            return `${(a * 100).toFixed(4)}% ${(b * 100).toFixed(4)}%`;
        },
    };
}

/* Both selection and insertion sort move their "active" element (minimum /
   key) left along a slot grid. Bars keep their value and height and relocate
   visually via cumulative translateX, so a slot always shows the value that
   belongs there. This is the ghost-shift model.

   Shared slot bookkeeping: each DOM shard is one value with a fixed height;
   a bar's physical slot is tracked through the choreography and its absolute
   translateX is derived from (currentSlot - originalSlot) * slotWidth. On a
   swap the two bars trade slots by "crossing" over each other. */

/* The slot-field math shared by all act sections: px width of one bar slot
   (bar width + gap) and the stage-relative x of the centre of slot i. */
function shardSlotMath(field, stage) {
    const m = measureShardField(field, stage);
    return {
        slot: m.slot,
        gap: m.gap,
        fieldLeft: m.fieldLeft,
        slotCx: (i) => m.fieldLeft + i * m.slot + (m.slot - m.gap) / 2,
    };
}
function generateSelectionKeyframes(array, steps, field, stage) {
    const n = array.length;
    const spread = 100 / steps.length;
    const bevel = ACTI_STATE.bevel;
    const bg = ACTI_STATE.bg;
    const measure = measureShardField(field, stage);
    const slot = measure.slot;
    const gap = measure.gap;
    const pinLeftX = (i) => measure.fieldLeft + i * slot + (slot - gap) / 2;

    const arr = [...array];
    const domP = array.map((_, i) => i);
    const xPx = new Array(n).fill(0);
    const frags = new Map();
    const add = (dom, snippet) => {
        if (!frags.has(dom)) frags.set(dom, []);
        frags.get(dom).push(snippet);
    };

    let minIdx = 0;
    let pinFrags = '';
    let lastSortedP = 0;
    let lastSortedDom = -1;

    steps.forEach((step, si) => {
        const p = (si / steps.length) * 100;
        const next = Math.min(100, p + spread);

        if (step.type === 'compare') {
            pinFrags += `${pct(p)}% { left: ${pct(pinLeftX(minIdx))}px; opacity: 1; } `;
            [step.i, step.j].forEach(idx => {
                const dom = domP[idx];
                add(dom,
                    `${pct(p)}% { clip-path: ${bevel.compare}; background: ${bg.compare}; transform: translateX(${pct(xPx[dom])}px) translateY(-3px) scaleY(1.03); } ` +
                    `${pct(next)}% { clip-path: ${bevel.base}; background: ${bg.base}; transform: translateX(${pct(xPx[dom])}px) translateY(0px) scaleY(1); }`
                );
            });
            if (arr[step.j] < arr[step.i]) minIdx = step.j;
        } else if (step.type === 'swap') {
            const a = step.i;
            const b = step.j;
            const k = b - a;
            const hold = Math.min(100, p + spread * 1.7);
            const dip = p + (hold - p) * 0.82;
            const mover = domP[b];
            const host = domP[a];
            const moverOld = xPx[mover];
            const hostOld = xPx[host];

            if (slot) {
                const moverNew = moverOld - k * slot;
                const hostNew = hostOld + k * slot;

                add(mover,
                    `${pct(p)}% { clip-path: ${bevel.swap}; background: ${bg.swap}; transform: translateX(${pct(moverOld)}px) translateY(-10px) scaleY(1.08); } ` +
                    `${pct(dip)}% { clip-path: ${bevel.swap}; background: ${bg.swap}; transform: translateX(${pct(moverNew)}px) translateY(-10px) scaleY(1.08); } ` +
                    `${pct(hold)}% { clip-path: ${bevel.base}; background: ${bg.base}; transform: translateX(${pct(moverNew)}px) translateY(0px) scaleY(1); }`
                );
                add(host,
                    `${pct(p)}% { clip-path: ${bevel.swap}; background: ${bg.swap}; transform: translateX(${pct(hostOld)}px) translateY(4px) scaleY(0.92); } ` +
                    `${pct(dip)}% { clip-path: ${bevel.swap}; background: ${bg.swap}; transform: translateX(${pct(hostNew)}px) translateY(4px) scaleY(0.92); } ` +
                    `${pct(hold)}% { clip-path: ${bevel.base}; background: ${bg.base}; transform: translateX(${pct(hostNew)}px) translateY(0px) scaleY(1); }`
                );
                xPx[mover] = moverNew;
                xPx[host] = hostNew;
            }

            pinFrags += `${pct(p)}% { left: ${pct(pinLeftX(b))}px; opacity: 1; } ` +
                        `${pct(hold)}% { left: ${pct(pinLeftX(a))}px; opacity: 1; } `;

            const tmp = domP[a];
            domP[a] = domP[b];
            domP[b] = tmp;
            const val = arr[a];
            arr[a] = arr[b];
            arr[b] = val;
            minIdx = a;
        } else if (step.type === 'sorted') {
            const dom = domP[step.i];
            add(dom,
                `${pct(p)}% { clip-path: ${bevel.settled}; background: ${bg.settled}; transform: translateX(${pct(xPx[dom])}px); } `
            );
            pinFrags += `${pct(p)}% { left: ${pct(pinLeftX(step.i))}px; opacity: 0; } `;
            lastSortedP = p;
            lastSortedDom = dom;
        }
    });

    if (lastSortedDom >= 0) {
        add(lastSortedDom,
            `${pct(lastSortedP + 0.2)}% { background: var(--face); } ` +
            `${pct(Math.min(100, lastSortedP + 1.6))}% { background: ${bg.settled}; } `
        );
    }

    let css = '';
    for (let i = 0; i < n; i++) {
        const fragList = frags.get(i) || [];
        css += `@keyframes selection-shard-${i} { ` +
            `0% { clip-path: ${bevel.base}; background: ${bg.base}; transform: translateX(0px); } ` +
            `${fragList.join('')}` +
            `100% { clip-path: ${bevel.settled}; background: ${bg.settled}; transform: translateX(${pct(xPx[i])}px); } } `;
    }
    css += `@keyframes selection-minpin-move { ` +
        `0% { left: ${pct(pinLeftX(0))}px; opacity: 0; } ` +
        `${pinFrags}` +
        `100% { left: ${pct(pinLeftX(n - 1))}px; opacity: 0; } }`;
    return css;
}

function generateInsertionKeyframes(array, steps, field, stage) {
    const n = array.length;
    const spread = 100 / steps.length;
    const bevel = ACTI_STATE.bevel;
    const bg = ACTI_STATE.bg;
    const measure = measureShardField(field, stage);
    const slot = measure.slot;

    const arr = [...array];
    const domP = array.map((_, i) => i);
    const xPx = new Array(n).fill(0);
    const frags = new Map();
    const add = (dom, snippet) => {
        if (!frags.has(dom)) frags.set(dom, []);
        frags.get(dom).push(snippet);
    };

    let lastSortedP = 0;
    let lastSortedDom = -1;

    steps.forEach((step, si) => {
        const p = (si / steps.length) * 100;
        const next = Math.min(100, p + spread);

        if (step.type === 'compare') {
            const host = domP[step.i];
            const key = domP[step.j];
            add(host,
                `${pct(p)}% { clip-path: ${bevel.compare}; background: ${bg.compare}; transform: translateX(${pct(xPx[host])}px) translateY(-3px) scaleY(1.03); } ` +
                `${pct(next)}% { clip-path: ${bevel.base}; background: ${bg.base}; transform: translateX(${pct(xPx[host])}px) translateY(0px) scaleY(1); }`
            );
            add(key,
                `${pct(p)}% { clip-path: ${bevel.compare}; background: ${bg.compare}; transform: translateX(${pct(xPx[key])}px) translateY(-8px) scaleY(1.04); } ` +
                `${pct(next)}% { clip-path: ${bevel.base}; background: ${bg.base}; transform: translateX(${pct(xPx[key])}px) translateY(0px) scaleY(1); }`
            );
        } else if (step.type === 'swap') {
            const a = step.i;
            const b = step.j;
            const hold = Math.min(100, p + spread * 1.7);
            const dip = p + (hold - p) * 0.82;
            const mover = domP[b];
            const host = domP[a];
            const moverOld = xPx[mover];
            const hostOld = xPx[host];
            const walk = moverOld - slot;
            const hostNew = hostOld + slot;

            add(mover,
                `${pct(p)}% { clip-path: ${bevel.swap}; background: ${bg.swap}; transform: translateX(${pct(moverOld)}px) translateY(-8px) scaleY(1.06); } ` +
                `${pct(dip)}% { clip-path: ${bevel.swap}; background: ${bg.swap}; transform: translateX(${pct(walk)}px) translateY(-8px) scaleY(1.06); } ` +
                `${pct(hold)}% { clip-path: ${bevel.base}; background: ${bg.base}; transform: translateX(${pct(walk)}px) translateY(0px) scaleY(1); }`
            );
            add(host,
                `${pct(p)}% { clip-path: ${bevel.swap}; background: ${bg.swap}; transform: translateX(${pct(hostOld)}px) translateY(4px) scaleY(0.92); } ` +
                `${pct(hold)}% { clip-path: ${bevel.base}; background: ${bg.base}; transform: translateX(${pct(hostNew)}px) translateY(0px) scaleY(1); }`
            );
            xPx[mover] = walk;
            xPx[host] = hostNew;

            const tmpDom = domP[a];
            domP[a] = domP[b];
            domP[b] = tmpDom;
            const tmpVal = arr[a];
            arr[a] = arr[b];
            arr[b] = tmpVal;
        } else if (step.type === 'sorted') {
            const dom = domP[step.i];
            add(dom,
                `${pct(p)}% { clip-path: ${bevel.settled}; background: ${bg.settled}; transform: translateX(${pct(xPx[dom])}px); } `
            );
            lastSortedP = p;
            lastSortedDom = dom;
        }
    });

    if (lastSortedDom >= 0) {
        add(lastSortedDom,
            `${pct(lastSortedP + 0.2)}% { background: var(--face); } ` +
            `${pct(Math.min(100, lastSortedP + 1.6))}% { background: ${bg.settled}; } `
        );
    }

    let css = '';
    for (let i = 0; i < n; i++) {
        const fragList = frags.get(i) || [];
        css += `@keyframes insertion-shard-${i} { ` +
            `0% { clip-path: ${bevel.base}; background: ${bg.base}; transform: translateX(0px); } ` +
            `${fragList.join('')}` +
            `100% { clip-path: ${bevel.settled}; background: ${bg.settled}; transform: translateX(${pct(xPx[i])}px); } } `;
    }
    return css;
}

function bindActIShardAnimations(prefix, field, range) {
    field.querySelectorAll(`.${prefix}-shard`).forEach((bar, i) => {
        bar.style.animation = `${prefix}-shard-${i} auto linear`;
        bar.style.animationTimeline = 'scroll(root)';
        if (range) bar.style.animationRange = range;
        bar.style.animationFillMode = 'both';
    });
}

function setupSelectionSortAnimations() {
    const section = document.querySelector('.algorithm-section--selection');
    const stage = section && section.querySelector('.shard-stage');
    const field = document.getElementById('selection-field');
    const pin = document.getElementById('selection-minpin');
    if (!stage || !field || !pin) return;

    const array = generateHeroArray(ACT_I_CONFIG.bars);
    const steps = window.selectionSort([...array]);

    buildActIShardField(field, array, 'selection-shard');
    const css = generateSelectionKeyframes(array, steps, field, stage);
    injectActIStyle('selection-keyframes', css);

    registerClickToPlay({
        algorithm: 'selection',
        section,
        stage,
        field,
        dynamic: 'sort',
        array,
        steps,
        shardClass: 'selection-shard',
        overlays: [{ id: 'selection-minpin', rule: 'selection-minpin-move' }],
    });

    if (!NarrativeState.scrollSupported) return;

    const range = buildScrollRange(section);
    bindActIShardAnimations('selection', field, range && range.full);
    pin.style.animation = 'selection-minpin-move auto linear';
    pin.style.animationTimeline = 'scroll(root)';
    if (range) pin.style.animationRange = range.full;
    pin.style.animationFillMode = 'both';
}

function setupInsertionSortAnimations() {
    const section = document.querySelector('.algorithm-section--insertion');
    const stage = section && section.querySelector('.shard-stage');
    const field = document.getElementById('insertion-field');
    if (!stage || !field) return;

    const array = generateHeroArray(ACT_I_CONFIG.bars);
    const steps = window.insertionSort([...array]);

    buildActIShardField(field, array, 'insertion-shard');
    const css = generateInsertionKeyframes(array, steps, field, stage);
    injectActIStyle('insertion-keyframes', css);

    registerClickToPlay({
        algorithm: 'insertion',
        section,
        stage,
        field,
        dynamic: 'sort',
        array,
        steps,
        shardClass: 'insertion-shard',
        overlays: [],
    });

    if (!NarrativeState.scrollSupported) return;

    const range = buildScrollRange(section);
    bindActIShardAnimations('insertion', field, range && range.full);
}


/* Act II: Merge Sort. Merge never swaps; it overwrites lanes. Each merge of a
   window lifts the smaller front out of its half and drops it into the next
   merged slot; the elements standing between the source and the target step
   aside to keep every slot filled. Window splits are precomputed with the same
   recursion merge.js uses, so each compare/overwrite maps to exactly one
   half-front. */
function generateMergeKeyframes2(array, steps, field, stage) {
    const n = array.length;
    const spread = 100 / steps.length;
    const bevel = ACTI_STATE.bevel;
    const bg = ACTI_STATE.bg;
    const M = shardSlotMath(field, stage);
    const s = M.slot;

    const domSlot = Array.from({ length: n }, (_, i) => i);
    const slotDom = Array.from({ length: n }, (_, i) => i);
    const carr = [...array];
    const frags = new Map();
    const add = (dom, snippet) => {
        if (!frags.has(dom)) frags.set(dom, []);
        frags.get(dom).push(snippet);
    };
    let sutureFrags = '';
    const xOf = (dom) => (domSlot[dom] - dom) * s;

    function moveDom(srcPos, tgt) {
        const id = slotDom[srcPos];
        slotDom.splice(srcPos, 1);
        slotDom.splice(tgt, 0, id);
        const lo = Math.min(srcPos, tgt);
        const hi = Math.max(srcPos, tgt);
        for (let i = lo; i <= hi; i++) domSlot[slotDom[i]] = i;
    }

    const windows = [];
    (function collect(start, end) {
        if (end - start <= 1) return;
        const mid = Math.floor((start + end) / 2);
        collect(start, mid);
        collect(mid, end);
        windows.push({ start, mid, end });
    })(0, n);

    let firstSutureX = 0;
    let wi = 0;
    let cur = null;
    let lastSortedP = 0;
    let lastSortedDom = -1;

    steps.forEach((step, si) => {
        const p = (si / steps.length) * 100;
        const next = Math.min(100, p + spread);

        while (wi < windows.length) {
            const w = windows[wi];
            const match = step.type === 'overwrite'
                ? step.i >= w.start && step.i < w.end
                : step.i >= w.start && step.i < w.mid && step.j >= w.mid && step.j < w.end;
            if (match) break;
            if (step.type === 'sorted') break;
            wi++;
            cur = null;
        }
        if (wi >= windows.length) {
            if (step.type === 'sorted') {
                const dom = slotDom[step.i];
                add(dom,
                    `${pct(p)}% { clip-path: ${bevel.settled}; background: ${bg.settled}; transform: translateX(${pct(xOf(dom))}px); } `
                );
                lastSortedP = p;
                lastSortedDom = dom;
            }
            return;
        }

        const w = windows[wi];
        if (!cur) {
            cur = {
                li: 0,
                rj: 0,
                w,
                leftVal: carr.slice(w.start, w.mid),
                rightVal: carr.slice(w.mid, w.end),
                leftIds: slotDom.slice(w.start, w.mid),
                rightIds: slotDom.slice(w.mid, w.end),
            };
            const sx = M.slotCx(w.mid) - 0.5;
            if (!firstSutureX) firstSutureX = sx;
        }

        if (step.type === 'compare') {
            const lId = cur.leftIds[cur.li];
            const rId = cur.rightIds[cur.rj];
            [lId, rId].forEach(id => add(id,
                `${pct(p)}% { clip-path: ${bevel.compare}; background: ${bg.compare}; transform: translateX(${pct(xOf(id))}px) translateY(-3px) scaleY(1.03); z-index: 2; } ` +
                `${pct(next)}% { clip-path: ${bevel.base}; background: ${bg.base}; transform: translateX(${pct(xOf(id))}px) translateY(0px) scaleY(1); z-index: 0; } `
            ));
            sutureFrags += `${pct(p)}% { left: ${pct(M.slotCx(w.mid) - 0.5)}px; opacity: 0.55; } `;
        } else if (step.type === 'overwrite') {
            const k = step.i;
            const held = Math.min(100, p + spread * 1.7);
            const dip = p + (held - p) * 0.82;
            const lv = cur.li < cur.leftVal.length ? cur.leftVal[cur.li] : undefined;
            let srcId;
            if (lv === step.value) {
                srcId = cur.leftIds[cur.li];
                cur.li++;
            } else {
                srcId = cur.rightIds[cur.rj];
                cur.rj++;
            }
            const srcPos = domSlot[srcId];
            const xNew = (k - srcId) * s;
            const slideEnd = dip + (held - dip) * 0.7;

            const shifts = [];
            const lo = Math.min(srcPos, k);
            const hi = Math.max(srcPos, k);
            for (let pos = lo; pos <= hi; pos++) {
                if (pos === srcPos) continue;
                const id = slotDom[pos];
                shifts.push({ id, oldX: (pos - id) * s });
            }

            add(srcId,
                `${pct(p)}% { clip-path: ${bevel.swap}; background: ${bg.swap}; transform: translateX(${pct(xOf(srcId))}px) translateY(-12px) scaleY(1.08); z-index: 3; } ` +
                `${pct(slideEnd)}% { clip-path: ${bevel.swap}; background: ${bg.swap}; transform: translateX(${pct(xNew)}px) translateY(-12px) scaleY(1.08); z-index: 3; } ` +
                `${pct(held)}% { clip-path: ${bevel.base}; background: ${bg.base}; transform: translateX(${pct(xNew)}px) translateY(0px) scaleY(1); z-index: 0; } `
            );

            moveDom(srcPos, k);
            shifts.forEach(sh => {
                const newX = (domSlot[sh.id] - sh.id) * s;
                add(sh.id,
                    `${pct(p)}% { clip-path: ${bevel.base}; background: ${bg.base}; transform: translateX(${pct(sh.oldX)}px) translateY(4px) scaleY(0.92); z-index: 0; } ` +
                    `${pct(held)}% { clip-path: ${bevel.base}; background: ${bg.base}; transform: translateX(${pct(newX)}px) translateY(0px) scaleY(1); z-index: 0; } `
                );
            });

            carr[k] = step.value;
            const fadeP = Math.min(100, p + spread * 1.2);
            sutureFrags += `${pct(fadeP)}% { left: ${pct(M.slotCx(w.mid) - 0.5)}px; opacity: 0; } `;
        }
    });

    if (lastSortedDom >= 0) {
        add(lastSortedDom,
            `${pct(lastSortedP + 0.2)}% { background: var(--face); } ` +
            `${pct(Math.min(100, lastSortedP + 1.6))}% { background: ${bg.settled}; } `
        );
    }

    let css = '';
    for (let i = 0; i < n; i++) {
        const fragList = frags.get(i) || [];
        css += `@keyframes merge-shard-${i} { ` +
            `0% { clip-path: ${bevel.base}; background: ${bg.base}; transform: translateX(0px) translateY(0px) scaleY(1); } ` +
            `${fragList.join('')}` +
            `100% { clip-path: ${bevel.settled}; background: ${bg.settled}; transform: translateX(${pct(xOf(i))}px) translateY(0px) scaleY(1); } } `;
    }
    css += `@keyframes merge-suture-move { ` +
        `0% { left: ${pct(firstSutureX || 0)}px; opacity: 0; } ` +
        `${sutureFrags}` +
        `100% { left: ${pct(firstSutureX || 0)}px; opacity: 0; } }`;
    return css;
}

/* Act II: Quick Sort. A pivot is crowned and held at the far end of the active
   range while a moving boundary grows the "all smaller" region on the left.
   Elements trade slots by crossing; when the partition ends, the pivot drops
   into the boundary slot and stays there (locked until the final all-sorted
   sweep marks the rest). */
function generateQuickKeyframes(array, steps, field, stage) {
    const n = array.length;
    const spread = 100 / steps.length;
    const bevel = ACTI_STATE.bevel;
    const bg = ACTI_STATE.bg;
    const M = shardSlotMath(field, stage);
    const s = M.slot;

    const domSlot = Array.from({ length: n }, (_, i) => i);
    const slotDom = Array.from({ length: n }, (_, i) => i);
    const frags = new Map();
    const add = (dom, snippet) => {
        if (!frags.has(dom)) frags.set(dom, []);
        frags.get(dom).push(snippet);
    };
    let crownFrags = '';
    let boundFrags = '';
    const xOf = (dom) => (domSlot[dom] - dom) * s;

    function crossExchange(a, b, p, held) {
        const idA = slotDom[a];
        const idB = slotDom[b];
        const aX0 = xOf(idA);
        const bX0 = xOf(idB);

        slotDom[a] = idB;
        slotDom[b] = idA;
        domSlot[idA] = b;
        domSlot[idB] = a;

        const aX1 = xOf(idA);
        const bX1 = xOf(idB);
        const midp = p + (held - p) * 0.5;
        const aMid = (aX0 + aX1) / 2;
        const bMid = (bX0 + bX1) / 2;

        add(idA,
            `${pct(p)}% { clip-path: ${bevel.swap}; background: ${bg.swap}; transform: translateX(${pct(aX0)}px) translateY(-6px) scaleY(1.08); z-index: 3; } ` +
            `${pct(midp)}% { clip-path: ${bevel.swap}; background: ${bg.swap}; transform: translateX(${pct(aMid)}px) translateY(-6px) scaleY(1.05); z-index: 3; } ` +
            `${pct(held)}% { clip-path: ${bevel.base}; background: ${bg.base}; transform: translateX(${pct(aX1)}px) translateY(0px) scaleY(1); z-index: 1; } `
        );
        add(idB,
            `${pct(p)}% { clip-path: ${bevel.swap}; background: ${bg.swap}; transform: translateX(${pct(bX0)}px) translateY(-6px) scaleY(1.08); z-index: 3; } ` +
            `${pct(midp)}% { clip-path: ${bevel.swap}; background: ${bg.swap}; transform: translateX(${pct(bMid)}px) translateY(-6px) scaleY(1.05); z-index: 3; } ` +
            `${pct(held)}% { clip-path: ${bevel.base}; background: ${bg.base}; transform: translateX(${pct(bX1)}px) translateY(0px) scaleY(1); z-index: 1; } `
        );
    }

    let chunk = null;
    let firstCrownX = 0;
    let lastSortedP = 0;
    let lastSortedDom = -1;

    function beginChunk(compare, p) {
        chunk = { low: compare.i, high: compare.j, scanJ: compare.i };
        const cx = M.slotCx(compare.j);
        if (!firstCrownX) firstCrownX = cx;
        crownFrags += `${pct(Math.max(0, p - 0.06))}% { left: ${pct(cx)}px; opacity: 0; } ` +
                      `${pct(p)}% { left: ${pct(cx)}px; opacity: 0.9; } `;
        boundFrags += `${pct(Math.max(0, p - 0.06))}% { left: ${pct(M.fieldLeft + compare.i * s)}px; opacity: 0; } ` +
                      `${pct(p)}% { left: ${pct(M.fieldLeft + compare.i * s)}px; opacity: 0.5; } `;
    }

    function closeChunk(p) {
        if (!chunk) return;
        crownFrags += `${pct(p)}% { opacity: 0; } `;
        boundFrags += `${pct(p)}% { opacity: 0; } `;
        chunk = null;
    }

    steps.forEach((step, si) => {
        const p = (si / steps.length) * 100;
        const next = Math.min(100, p + spread);

        if (step.type === 'compare') {
            if (chunk && step.i === chunk.scanJ + 1 && step.j === chunk.high) {
                chunk.scanJ = step.i;
            } else {
                closeChunk(p);
                beginChunk(step, p);
            }
            const scanDom = slotDom[step.i];
            const pivotDom = slotDom[step.j];
            [scanDom, pivotDom].forEach(id => add(id,
                `${pct(p)}% { clip-path: ${bevel.compare}; background: ${bg.compare}; transform: translateX(${pct(xOf(id))}px) translateY(-3px) scaleY(1.03); z-index: 2; } ` +
                `${pct(next)}% { clip-path: ${bevel.base}; background: ${bg.base}; transform: translateX(${pct(xOf(id))}px) translateY(0px) scaleY(1); z-index: 0; } `
            ));
        } else if (step.type === 'swap') {
            const held = Math.min(100, p + spread * 1.7);
            const dip = p + (held - p) * 0.82;

            if (chunk && step.j === chunk.high) {
                // Pivot place-swap: pivot slides into the boundary slot and locks
                const pi = step.i;
                const pivotDom = slotDom[chunk.high];
                crossExchange(pi, chunk.high, p, held);

                crownFrags += `${pct(p)}% { left: ${pct(M.slotCx(chunk.high))}px; opacity: 0.9; } ` +
                              `${pct(dip)}% { left: ${pct(M.slotCx(pi))}px; opacity: 0.9; } ` +
                              `${pct(held)}% { left: ${pct(M.slotCx(pi))}px; opacity: 0; } `;
                boundFrags += `${pct(p)}% { opacity: 0; } `;

                add(pivotDom,
                    `${pct(held)}% { clip-path: ${bevel.settled}; background: ${bg.settled}; transform: translateX(${pct(xOf(pivotDom))}px); z-index: 0; } `
                );
                closeChunk(held);
            } else {
                crossExchange(step.i, step.j, p, held);
                boundFrags += `${pct(p)}% { left: ${pct(M.fieldLeft + (step.i + 1) * s)}px; opacity: 0.5; } `;
            }
        } else if (step.type === 'sorted') {
            const dom = slotDom[step.i];
            add(dom,
                `${pct(p)}% { clip-path: ${bevel.settled}; background: ${bg.settled}; transform: translateX(${pct(xOf(dom))}px); } `
            );
            lastSortedP = p;
            lastSortedDom = dom;
        }
    });

    if (lastSortedDom >= 0) {
        add(lastSortedDom,
            `${pct(lastSortedP + 0.2)}% { background: var(--face); } ` +
            `${pct(Math.min(100, lastSortedP + 1.6))}% { background: ${bg.settled}; } `
        );
    }

    let css = '';
    for (let i = 0; i < n; i++) {
        const fragList = frags.get(i) || [];
        css += `@keyframes quick-shard-${i} { ` +
            `0% { clip-path: ${bevel.base}; background: ${bg.base}; transform: translateX(0px) translateY(0px) scaleY(1); } ` +
            `${fragList.join('')}` +
            `100% { clip-path: ${bevel.settled}; background: ${bg.settled}; transform: translateX(${pct(xOf(i))}px) translateY(0px) scaleY(1); } } `;
    }
    css += `@keyframes quick-crown-move { ` +
        `0% { left: ${pct(firstCrownX || 0)}px; opacity: 0; } ` +
        `${crownFrags}` +
        `100% { left: ${pct(firstCrownX || 0)}px; opacity: 0; } } `;
    css += `@keyframes quick-bound-move { ` +
        `0% { left: ${pct(M.fieldLeft || 0)}px; opacity: 0; } ` +
        `${boundFrags}` +
        `100% { left: ${pct(M.fieldLeft || 0)}px; opacity: 0; } }`;
    return css;
}

function setupMergeSortAnimations() {
    const section = document.querySelector('.algorithm-section--merge');
    const stage = section && section.querySelector('.shard-stage');
    const field = document.getElementById('merge-field');
    const suture = document.getElementById('merge-suture');
    if (!stage || !field || !suture) return;

    const array = generateHeroArray(ACT_I_CONFIG.bars);
    const steps = window.mergeSort([...array]);

    buildActIShardField(field, array, 'merge-shard');
    const css = generateMergeKeyframes2(array, steps, field, stage);
    injectActIStyle('merge-keyframes', css);

    registerClickToPlay({
        algorithm: 'merge',
        section,
        stage,
        field,
        dynamic: 'sort',
        array,
        steps,
        shardClass: 'merge-shard',
        overlays: [{ id: 'merge-suture', rule: 'merge-suture-move' }],
    });

    if (!NarrativeState.scrollSupported) return;

    const range = buildScrollRange(section);
    bindActIShardAnimations('merge', field, range && range.full);
    suture.style.animation = 'merge-suture-move auto linear';
    suture.style.animationTimeline = 'scroll(root)';
    if (range) suture.style.animationRange = range.full;
    suture.style.animationFillMode = 'both';
}

function setupQuickSortAnimations() {
    const section = document.querySelector('.algorithm-section--quick');
    const stage = section && section.querySelector('.shard-stage');
    const field = document.getElementById('quick-field');
    const crown = document.getElementById('quick-crown');
    const bound = document.getElementById('quick-bound');
    if (!stage || !field || !crown || !bound) return;

    const array = generateHeroArray(ACT_I_CONFIG.bars);
    const steps = window.quickSort([...array]);

    buildActIShardField(field, array, 'quick-shard');
    const css = generateQuickKeyframes(array, steps, field, stage);
    injectActIStyle('quick-keyframes', css);

    registerClickToPlay({
        algorithm: 'quick',
        section,
        stage,
        field,
        dynamic: 'sort',
        array,
        steps,
        shardClass: 'quick-shard',
        overlays: [
            { id: 'quick-crown', rule: 'quick-crown-move' },
            { id: 'quick-bound', rule: 'quick-bound-move' },
        ],
    });

    if (!NarrativeState.scrollSupported) return;

    const range = buildScrollRange(section);
    bindActIShardAnimations('quick', field, range && range.full);
    crown.style.animation = 'quick-crown-move auto linear';
    crown.style.animationTimeline = 'scroll(root)';
    if (range) crown.style.animationRange = range.full;
    crown.style.animationFillMode = 'both';
    bound.style.animation = 'quick-bound-move auto linear';
    bound.style.animationTimeline = 'scroll(root)';
    if (range) bound.style.animationRange = range.full;
    bound.style.animationFillMode = 'both';
}


function generateNarrationSteps(algorithm, steps) {
    const narration = [];

    switch (algorithm) {
        case 'merge':
            narration.push(
                { text: 'Split the array in half, down to single elements', phase: 'split' },
                { text: 'Halves are sorted runs of one', phase: 'isolate' },
                { text: 'Compare the smallest from each: <code>left[0]</code> vs <code>right[0]</code>', phase: 'compare' },
                { text: 'The lower value lifts into the merged slot and settles', phase: 'merge-slot' },
                { text: 'Keep comparing fronts until one half runs out', phase: 'merge-fronts' },
                { text: 'Done. The array has merged back into sorted order', phase: 'done' }
            );
            break;
        case 'bubble':
            narration.push(
                { text: 'Compare adjacent elements: <code>arr[0]</code> and <code>arr[1]</code>', phase: 'compare' },
                { text: 'Swap if out of order', phase: 'swap' },
                { text: 'Move to next pair: <code>arr[1]</code> and <code>arr[2]</code>', phase: 'compare' },
                { text: 'Largest value bubbles to the end of the array', phase: 'swap' },
                { text: 'Repeat passes until no swaps needed', phase: 'compare' },
                { text: 'Done: array is sorted', phase: 'done' }
            );
            break;
        case 'selection':
            narration.push(
                { text: 'Find the smallest value left in the unsorted region', phase: 'probe' },
                { text: 'Compare <code>arr[j]</code> against the running minimum', phase: 'compare' },
                { text: 'When the scan ends the minimum walks forward to the boundary', phase: 'walk' },
                { text: 'It snaps into place. The sorted floor grows to <code>arr[i]</code>', phase: 'snap' },
                { text: 'Repeat until only the last element is left standing', phase: 'repeat' },
                { text: 'Done. The whole array has settled into sorted order', phase: 'done' }
            );
            break;
        case 'insertion':
            narration.push(
                { text: 'Lift <code>arr[i]</code> as the key', phase: 'key' },
                { text: 'Compare the key against the sorted prefix', phase: 'compare' },
                { text: 'Larger elements shift right, one slot at a time', phase: 'shift' },
                { text: 'The key slides left and drops into the gap', phase: 'slide' },
                { text: 'The sorted prefix grows by one space', phase: 'grow' },
                { text: 'Done. The whole array has settled into sorted order', phase: 'done' }
            );
            break;
        case 'quick':
            narration.push(
                { text: 'Lift <code>arr[high]</code> as the pivot', phase: 'pivot' },
                { text: 'The boundary grows: smaller values slide left', phase: 'partition' },
                { text: 'Compare <code>arr[j]</code> against the pivot', phase: 'compare' },
                { text: 'Swap it across the boundary and move on', phase: 'swap-boundary' },
                { text: 'The pivot drops into its final slot', phase: 'pivot-place' },
                { text: 'Done. Each recursive side has settled into sorted order', phase: 'done' }
            );
            break;
        case 'bfs':
            narration.push(
                { text: 'The wavefront seeds at the start corner', phase: 'seed' },
                { text: 'Ring one: every neighbor of the seed is queued', phase: 'ring-1' },
                { text: 'The wavefront radiates outward, one full ring per step', phase: 'radiate' },
                { text: 'Later rings sweep the far half of the field', phase: 'rings-out' },
                { text: 'The wavefront reaches the goal', phase: 'goal' },
                { text: 'Parent links thread back to the start: the shortest path draws home', phase: 'path' }
            );
            break;
        case 'astar':
            narration.push(
                { text: 'Every frontier cell is scored <code>f = g + h</code>, with Manhattan distance', phase: 'heuristic' },
                { text: 'The frontier always opens the lowest <code>f</code> first', phase: 'frontier' },
                { text: 'The search leans down-right toward the goal', phase: 'bias' },
                { text: 'Dead-end pockets stay closed: their <code>f</code> beats the path cost', phase: 'pockets' },
                { text: 'The goal is reached and whole pockets were never opened', phase: 'goal' },
                { text: 'Parent links trace home to the same shortest path', phase: 'path' }
            );
            break;
        case 'dfs':
            narration.push(
                { text: 'The search seeds at the start corner', phase: 'seed' },
                { text: 'It dives deep down one branch before trying any side track', phase: 'deep' },
                { text: 'A stack, not a queue: the latest discovery is explored first', phase: 'stack' },
                { text: 'Backtracking opens the pockets BFS would have flooded', phase: 'backtrack' },
                { text: 'The goal is reached — but no guarantee it is the shortest way there', phase: 'goal' },
                { text: 'Parent links thread back to the start: the route it happened to find', phase: 'path' }
            );
            break;
        case 'dijkstra':
            narration.push(
                { text: 'Every frontier cell is scored by its distance from the start', phase: 'seed' },
                { text: 'The cheapest unvisited cell is always expanded next', phase: 'cheapest' },
                { text: 'Each equal step costs one, so distance grows in rings', phase: 'rings' },
                { text: 'With no weights to tip it, this reduces to BFS', phase: 'like-bfs' },
                { text: 'The goal is reached with its shortest distance locked in', phase: 'goal' },
                { text: 'Parent links trace home to the same shortest path', phase: 'path' }
            );
            break;
    }

    return narration;
}

function getAlgorithmFunction(algorithm) {
    const sortingAlgorithms = ['bubble', 'selection', 'insertion', 'merge', 'quick'];
    const pathfindingAlgorithms = ['bfs', 'dfs', 'dijkstra', 'astar'];

    if (sortingAlgorithms.includes(algorithm)) {
        return window[`${algorithm}Sort`];
    } else if (pathfindingAlgorithms.includes(algorithm)) {
        return window[algorithm];
    }
    return null;
}

function createDefaultGrid(gridSize = 20) {
    const grid = [];
    for (let r = 0; r < gridSize; r++) {
        const row = [];
        for (let c = 0; c < gridSize; c++) {
            row.push(0);
        }
        grid.push(row);
    }
    return grid;
}

function createDefaultWalls(gridSize = 20) {
    const walls = [];
    for (let c = 5; c <= 14; c++) walls.push({ r: 8, c });
    for (let r = 8; r <= 12; r++) walls.push({ r, c: 14 });
    return walls;
}

/* The narrative's own wall layout: short combs reaching in from both edges
   with a clear central corridor. Every open cell is reachable, so BFS floods
   the whole field, while A* prunes the dead-end pockets the combs' tips
   create: on this grid it opens just over half as many cells. This gives the
   two Act III sections a visibly different, honest story. */
function createNarrativeWalls() {
    const walls = [];
    for (const r of [2, 6, 10, 14, 18]) {
        for (let c = 0; c <= 8; c++) walls.push({ r, c });
    }
    for (const r of [4, 8, 12, 16]) {
        for (let c = 12; c <= 19; c++) walls.push({ r, c });
    }
    return walls;
}

function renderNarrationSteps(containerId, algorithm) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const fn = getAlgorithmFunction(algorithm);
    if (!fn) {
        console.warn(`Algorithm function not found for: ${algorithm}`);
        return;
    }

    let steps;
    const sortingAlgorithms = ['bubble', 'selection', 'insertion', 'merge', 'quick'];
    const pathfindingAlgorithms = ['bfs', 'dfs', 'dijkstra', 'astar'];

    if (sortingAlgorithms.includes(algorithm)) {
        const array = generateHeroArray(16);
        steps = fn(array);
    } else if (pathfindingAlgorithms.includes(algorithm)) {
        const grid = createDefaultGrid();
        const walls = createNarrativeWalls();
        const start = { r: 0, c: 0 };
        const end = { r: 19, c: 19 };
        steps = fn(grid, start, end, walls);
    } else {
        console.warn(`Algorithm function not found for: ${algorithm}`);
        return;
    }

    const narration = generateNarrationSteps(algorithm, steps);

    container.innerHTML = '';
    narration.forEach((item, index) => {
        const step = document.createElement('div');
        step.className = 'narration-step';
        step.dataset.phase = item.phase;
        step.dataset.index = index;
        step.tabIndex = 0;
        step.innerHTML = `
            <span class="narration-step-index">${index + 1}</span>
            <span class="narration-step-text">${item.text}</span>
        `;
        container.appendChild(step);
    });
}

function setupScrollAnimations() {
    if (!NarrativeState.scrollSupported) return;

    const sections = document.querySelectorAll('.algorithm-section');
    sections.forEach(section => {
        const algorithm = section.dataset.algorithm;
        const narrationContainer = section.querySelector('.narration-steps');
        const vizStage = section.querySelector('.viz-stage, .merge-viz-container, .shard-stage, .grid-stage');

        if (!narrationContainer || !vizStage) return;

        const steps = narrationContainer.querySelectorAll('.narration-step');
        const range = buildScrollRange(section);
        steps.forEach((step, index) => {
            step.style.animation = 'narration-step-reveal auto linear';
            step.style.animationTimeline = 'scroll(root)';
            if (range) {
                step.style.animationRange = range.step(index, steps.length);
            } else {
                step.style.animationRange = `entry ${10 + index * 12}% cover ${25 + index * 12}%`;
            }
            step.style.animationFillMode = 'both';
        });
    });
}
/* ---------- Pathfinding (Act III) ---------- */

const PATH_VIZ = {
    gridSize: 20,
    base: '#1f1b16',
    visited: 'linear-gradient(180deg, #33434d, #4c6672)',
    path: '#d9ad4c',
};

/* The path cells are a 20x20 grid. Measure the field relative to its stage
   so overlays (halo, tilt arrow) can track real pixel positions. */
function measureGridField(field, stage) {
    const fRect = field.getBoundingClientRect();
    const sRect = stage.getBoundingClientRect();
    const gap = parseFloat(getComputedStyle(field).gap) || 2;
    const n = PATH_VIZ.gridSize;
    const cell = (fRect.width - gap * (n - 1)) / n;
    return {
        n,
        gap,
        cell,
        fieldLeft: fRect.left - sRect.left,
        fieldTop: fRect.top - sRect.top,
        cellCx: (c) => fRect.left - sRect.left + c * (cell + gap) + cell / 2,
        cellCy: (r) => fRect.top - sRect.top + r * (cell + gap) + cell / 2,
    };
}

function buildPathGrid(field, walls, start, end) {
    field.innerHTML = '';
    const wallSet = new Set(walls.map(w => `${w.r},${w.c}`));
    for (let r = 0; r < 20; r++) {
        for (let c = 0; c < 20; c++) {
            const cell = document.createElement('i');
            cell.className = 'path-cell';
            cell.dataset.r = r;
            cell.dataset.c = c;
            if (r === start.r && c === start.c) cell.classList.add('path-cell--start');
            else if (r === end.r && c === end.c) cell.classList.add('path-cell--end');
            else if (wallSet.has(`${r},${c}`)) cell.classList.add('path-cell--wall');
            field.appendChild(cell);
        }
    }
}

/* Keyframes are namespaced per algorithm (bfs-path-cell-*, dfs-path-cell-*,
   ...) so the four pathfinding sections each bind to their own rules. CSS
   resolves duplicate @keyframes names to the last declaration in document
   order, so an un-prefixed name would let the last-built algorithm's wave
   override every other section's animation. */
function generatePathCellKeyframes(cells, visited, path, prefix) {
    const vLen = visited.length;
    const pLen = path.length;
    const visitIdx = new Map(visited.map((node, i) => [`${node.r},${node.c}`, i]));
    const pathIdx = new Map(path.map((node, i) => [`${node.r},${node.c}`, i]));
    /* Visits spread across the first 60% of the scroll; the path amber draws
       across the last third, once the whole wave has moved through. */
    const visitPhase = (i) => 2 + (i / Math.max(1, vLen - 1)) * 58;
    const pathPhase = (j) => 62 + (j / Math.max(1, pLen - 1)) * 34;
    const { base, visited: vis, path: amber } = PATH_VIZ;

    /* A* can reach its goal before some path cells are ever popped out of the
       open set, so a cell can sit on the final route yet never appear in
       `visited`. Such cells still get their amber keyframe, timed from the
       path index as a proxy for when the search first touched them. */
    const phases = new Set(visited.map(n => `${n.r},${n.c}`));
    path.forEach(n => phases.add(`${n.r},${n.c}`));
    const phaseForKey = (key) => {
        if (pathIdx.has(key)) return { v: visitIdx.has(key) ? visitIdx.get(key) : -1, p: pathIdx.get(key) };
        if (visitIdx.has(key)) return { v: visitIdx.get(key), p: -1 };
        return null;
    };

    let css = '';
    Array.from(cells).forEach(cell => {
        if (cell.classList.contains('path-cell--start') ||
            cell.classList.contains('path-cell--end') ||
            cell.classList.contains('path-cell--wall')) return;
        const key = `${cell.dataset.r},${cell.dataset.c}`;
        if (!phases.has(key)) return; /* unreached cells stay base */
        const { v, p } = phaseForKey(key);
        const name = `${prefix}-path-cell-${cell.dataset.r}-${cell.dataset.c}`;
        const visitP = v >= 0 ? visitPhase(v) : visitPhase(p); /* discovered-not-popped proxy */
        if (p >= 0) {
            css += `@keyframes ${name} { ` +
                `0% { background: ${base}; } ` +
                `${pct(visitP)}% { background: ${vis}; } ` +
                `${pct(pathPhase(p))}% { background: ${amber}; } ` +
                `100% { background: ${amber}; } } `;
        } else {
            css += `@keyframes ${name} { ` +
                `0% { background: ${base}; } ` +
                `${pct(visitPhase(v))}% { background: ${vis}; } ` +
                `100% { background: ${vis}; } } `;
        }
    });
    return css;
}

function bindPathCell(cell, range, prefix) {
    cell.style.animation = `${prefix}-path-cell-${cell.dataset.r}-${cell.dataset.c} auto linear`;
    cell.style.animationTimeline = 'scroll(root)';
    if (range) cell.style.animationRange = range;
    cell.style.animationFillMode = 'both';
}

function bindActOverlay(el, name, range) {
    el.style.animation = `${name} auto linear`;
    el.style.animationTimeline = 'scroll(root)';
    if (range) el.style.animationRange = range;
    el.style.animationFillMode = 'both';
}

/* The BFS wave ring: a faint bone-white circle cupped at the start corner
   that swells to twice the field during the visit phase, then dies before
   the amber path draws so the payoff stays clean. */
function generateBFSHaloKeyframes(field, stage) {
    const m = measureGridField(field, stage);
    const d = field.getBoundingClientRect().width;
    const css = `@keyframes bfs-halo-pulse { ` +
        `0% { transform: scale(0.04); opacity: 0; } ` +
        `12% { opacity: 0.5; } ` +
        `55% { transform: scale(1.08); opacity: 0.28; } ` +
        `62% { transform: scale(1.08); opacity: 0; } ` +
        `100% { transform: scale(1.08); opacity: 0; } } `;
    return {
        css,
        left: m.cellCx(0) - d / 2,
        top: m.cellCy(0) - d / 2,
        size: d,
    };
}

/* The A* tilt arrow: a chevron that leans from pointing flat right at the
   start to 45deg down toward the goal while gliding across the field. */
function generateAStarTiltKeyframes(field, stage) {
    const m = measureGridField(field, stage);
    const lastCol = m.cellCx(m.n - 1);
    const lastRow = m.cellCy(m.n - 1);
    const dx = lastCol - m.cellCx(0);
    const dy = lastRow - m.cellCy(0);
    const css = `@keyframes astar-tilt-move { ` +
        `0% { transform: translate(0px, 0px) rotate(0deg); opacity: 0; } ` +
        `12% { opacity: 0.9; } ` +
        `55% { transform: translate(${pct(dx)}px, ${pct(dy)}px) rotate(45deg); opacity: 0.9; } ` +
        `62% { transform: translate(${pct(dx)}px, ${pct(dy)}px) rotate(45deg); opacity: 0; } ` +
        `100% { transform: translate(${pct(dx)}px, ${pct(dy)}px) rotate(45deg); opacity: 0; } } `;
    return { css, left: m.cellCx(0) - 9, top: m.cellCy(0) - 9 };
}

function setupPathfindingGrid(sectionId, algorithm) {
    const section = document.getElementById(sectionId);
    const stage = section.querySelector('.grid-stage');
    const field = document.getElementById(`${algorithm}-field`);
    if (!stage || !field) return;

    const grid = createDefaultGrid();
    const walls = createNarrativeWalls();
    const start = { r: 0, c: 0 };
    const end = { r: PATH_VIZ.gridSize - 1, c: PATH_VIZ.gridSize - 1 };
    const result = window[algorithm](grid, start, end, walls);

    buildPathGrid(field, walls, start, end);

    /* Final-state classes are read by the reduced-motion fallback and by any
       cell the keyframes never touch (unreached cells keep the base class). */
    result.visited.forEach(node => {
        const cell = field.querySelector(`[data-r="${node.r}"][data-c="${node.c}"]`);
        if (cell && !(node.r === start.r && node.c === start.c) && !(node.r === end.r && node.c === end.c)) {
            cell.classList.add('path-cell--visited');
        }
    });
    result.path.forEach(node => {
        const cell = field.querySelector(`[data-r="${node.r}"][data-c="${node.c}"]`);
        if (cell && !(node.r === start.r && node.c === start.c) && !(node.r === end.r && node.c === end.c)) {
            cell.classList.add('path-cell--path');
        }
    });

    const cellCss = generatePathCellKeyframes(field.children, result.visited, result.path, algorithm);
    let overlayCss = '';
    let overlay = null;
    let overlayName = '';
    if (algorithm === 'bfs') {
        const halo = generateBFSHaloKeyframes(field, stage);
        overlayCss = halo.css;
        overlay = document.getElementById('bfs-halo');
        overlay.style.left = `${pct(halo.left)}px`;
        overlay.style.top = `${pct(halo.top)}px`;
        overlay.style.width = `${pct(halo.size)}px`;
        overlay.style.height = `${pct(halo.size)}px`;
        overlay.style.transformOrigin = 'center';
        overlayName = 'bfs-halo-pulse';
    } else if (algorithm === 'astar') {
        const tilt = generateAStarTiltKeyframes(field, stage);
        overlayCss = tilt.css;
        overlay = document.getElementById('astar-tilt');
        overlay.style.left = `${pct(tilt.left)}px`;
        overlay.style.top = `${pct(tilt.top)}px`;
        overlay.style.transformOrigin = 'center';
        overlayName = 'astar-tilt-move';
    }
    injectActIStyle(`${algorithm}-path-keyframes`, cellCss + overlayCss);

    registerClickToPlay({
        algorithm,
        section,
        stage,
        field,
        dynamic: 'path',
        steps: result,
        overlays: [{ id: overlay && overlay.id, rule: overlayName }],
    });

    if (!NarrativeState.scrollSupported) return;

    const range = buildScrollRange(section);
    const rangeStr = range && range.full;
    Array.from(field.children).forEach(cell => {
        if (cell.classList.contains('path-cell--visited')) bindPathCell(cell, rangeStr, algorithm);
    });
    if (overlay) bindActOverlay(overlay, overlayName, rangeStr);
}

/* ---------- Footer (the closing act) ---------- */

/* The six veins draw in toward the seed during the first half of the
   footer's scroll, the citrine seed blooms at the convergence point, and
   the wordmark / title / sub / status / links rise into stillness. */
function setupFooterAnimations() {
    if (!NarrativeState.scrollSupported) return;

    const footer = document.getElementById('narrative-footer');
    const stage = footer && footer.querySelector('.footer-stage');
    if (!stage) return;

    const veins = footer.querySelectorAll('.footer-vein');
    const seed = footer.querySelector('.footer-seed');
    const wordmark = footer.querySelector('.footer-wordmark');
    const title = footer.querySelector('.footer-title');
    const sub = footer.querySelector('.footer-sub');
    const status = footer.querySelector('.footer-status');
    const links = footer.querySelector('.footer-links');

    let css = '';
    veins.forEach((vein, i) => {
        const name = `footer-vein-${i}`;
        css += `@keyframes ${name} { ` +
            `from { stroke-dashoffset: 1; opacity: 0; } ` +
            `to { stroke-dashoffset: 0; opacity: 0.7; } } `;
        vein.style.animation = `${name} auto linear`;
        vein.style.animationTimeline = 'view()';
        vein.style.animationRange = `entry ${2 + i * 6}% cover ${44 + i * 2}%`;
        vein.style.animationFillMode = 'both';
    });

    css += `@keyframes footer-seed-bloom { ` +
        `0% { opacity: 0; transform: translate(-50%, -50%) scale(0.4); } ` +
        `100% { opacity: 1; transform: translate(-50%, -50%) scale(1); } } `;
    bindFooterPiece(seed, 'footer-seed-bloom', 'entry 40% cover 62%');

    css += `@keyframes footer-copy-in { ` +
        `from { opacity: 0; transform: translateY(14px); } ` +
        `to { opacity: 1; transform: none; } } `;
    bindFooterPiece(wordmark, 'footer-copy-in', 'entry 48% cover 70%');
    bindFooterPiece(title, 'footer-copy-in', 'entry 53% cover 74%');
    bindFooterPiece(sub, 'footer-copy-in', 'entry 58% cover 78%');
    bindFooterPiece(status, 'footer-copy-in', 'entry 62% cover 82%');
    bindFooterPiece(links, 'footer-copy-in', 'entry 66% cover 88%');

    injectActIStyle('footer-keyframes', css);
}

function bindFooterPiece(el, name, range) {
    if (!el) return;
    el.style.animation = `${name} auto linear`;
    el.style.animationTimeline = 'view()';
    el.style.animationRange = range;
    el.style.animationFillMode = 'both';
}

function checkScrollSupport() {
    return CSS.supports('animation-timeline', 'view()');
}

function checkReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* Static fallback: browsers without CSS-native scroll animations (or with
   prefers-reduced-motion) keep the same narrative sections, laid out in
   flow with every stage showing its settled final state. No dashboard, no
   second interface. */
const STATIC_SHARD_FIELDS = [
    { id: 'bubble-field', cls: 'bubble-shard', bars: BUBBLE_CONFIG.bars },
    { id: 'selection-field', cls: 'selection-shard', bars: ACT_I_CONFIG.bars },
    { id: 'insertion-field', cls: 'insertion-shard', bars: ACT_I_CONFIG.bars },
    { id: 'merge-field', cls: 'merge-shard', bars: ACT_I_CONFIG.bars },
    { id: 'quick-field', cls: 'quick-shard', bars: ACT_I_CONFIG.bars },
];

function settleStaticField(fieldId) {
    const cfg = STATIC_SHARD_FIELDS.find(c => c.id === fieldId);
    if (!cfg) return;
    const field = document.getElementById(cfg.id);
    if (!field) return;
    const values = generateHeroArray(cfg.bars).sort((a, b) => a - b);
    buildActIShardField(field, values, cfg.cls);
    field.classList.add('shard-field--static-settled');
}

function buildStaticSettledFields() {
    STATIC_SHARD_FIELDS.forEach(({ id }) => settleStaticField(id));
}

function applyStaticFallback() {
    document.documentElement.classList.add('no-scroll-animations');

    if (hero.slab) {
        hero.p = 1;
        applyHeroProgress();
        finishHero();
    }

    /* Run the section setups so the static fallback has the same generated
       keyframes (and click-to-play specs) as the scroll path — the settled
       rebuild below only swaps the at-rest field content, not the rules. */
    setupBubbleSortAnimations();
    setupSelectionSortAnimations();
    setupInsertionSortAnimations();
    setupMergeSortAnimations();
    setupQuickSortAnimations();
    setupPathfindingGrid('section-bfs', 'bfs');
    setupPathfindingGrid('section-astar', 'astar');
    setupPathfindingGrid('section-dfs', 'dfs');
    setupPathfindingGrid('section-dijkstra', 'dijkstra');

    buildStaticSettledFields();
    bindAllClickToPlay();
    setupNarrationKeyboardNav();
}

/* The collapsed (≤1024px) sections report a taller height at
   DOMContentLoaded than after the embedded fonts rasterize, so a range
   baked during setup lands a few px late. Recompute every section range
   once fonts settle and re-bind, so the array finishes sorting exactly as
   the section bottom reaches the viewport bottom on all layouts. */
function rebindScrollRanges() {
    if (!NarrativeState.scrollSupported || !NarrativeState.initialized) return;

    document.querySelectorAll('.algorithm-section').forEach(section => {
        const range = buildScrollRange(section);
        if (!range) return;
        section.querySelectorAll('[style*="scroll(root)"]').forEach(el => {
            if (el.classList.contains('narration-step')) {
                const steps = el.parentElement.querySelectorAll('.narration-step');
                const index = Array.prototype.indexOf.call(steps, el);
                el.style.animationRange = range.step(index, steps.length);
            } else {
                el.style.animationRange = range.full;
            }
        });
    });
}

function initializeNarrative() {
    if (NarrativeState.initialized) return;

    NarrativeState.reducedMotion = checkReducedMotion();
    NarrativeState.scrollSupported = checkScrollSupport() && !NarrativeState.reducedMotion;

    initializeGeodeHero();

    renderNarrationSteps('narration-bubble', 'bubble');
    renderNarrationSteps('narration-selection', 'selection');
    renderNarrationSteps('narration-insertion', 'insertion');
    renderNarrationSteps('narration-merge', 'merge');
    renderNarrationSteps('narration-quick', 'quick');
    renderNarrationSteps('narration-bfs', 'bfs');
    renderNarrationSteps('narration-astar', 'astar');
    renderNarrationSteps('narration-dfs', 'dfs');
    renderNarrationSteps('narration-dijkstra', 'dijkstra');

    if (!NarrativeState.scrollSupported) {
        applyStaticFallback();
        NarrativeState.initialized = true;
        return;
    }

    setupBubbleSortAnimations();
    setupSelectionSortAnimations();
    setupInsertionSortAnimations();

    setupMergeSortAnimations();
    setupQuickSortAnimations();
    setupPathfindingGrid('section-bfs', 'bfs');
    setupPathfindingGrid('section-astar', 'astar');
    setupPathfindingGrid('section-dfs', 'dfs');
    setupPathfindingGrid('section-dijkstra', 'dijkstra');

    setupScrollAnimations();
    setupFooterAnimations();
    bindAllClickToPlay();
    setupNarrationKeyboardNav();

    NarrativeState.initialized = true;

    /* Re-measure ranges once fonts settle (collapsed sections shrink ~10px
       after the embedded fonts rasterize; on desktop secH is fixed at 3V so
       the recomputed range is unchanged there). */
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
            requestAnimationFrame(() => rebindScrollRanges());
        });
    }

    /* The collapsed/desktop range math depends on breakpoint and viewport
       height, so re-bind on resize too (debounced to one frame). */
    let resizeRaf = 0;
    window.addEventListener('resize', () => {
        if (!NarrativeState.initialized) return;
        cancelAnimationFrame(resizeRaf);
        resizeRaf = requestAnimationFrame(() => rebindScrollRanges());
    });
}

function setupNarrationKeyboardNav() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') return;
        if (e.target.closest('.narration-step')) {
            const steps = document.querySelectorAll('.narration-step');
            const currentIndex = Array.from(steps).findIndex(s => s === document.activeElement);
            if (currentIndex >= 0) {
                if (e.key === 'ArrowDown' && currentIndex < steps.length - 1) {
                    e.preventDefault();
                    steps[currentIndex + 1].focus();
                } else if (e.key === 'ArrowUp' && currentIndex > 0) {
                    e.preventDefault();
                    steps[currentIndex - 1].focus();
                }
            }
        }
    });
}

/* ---------- Click-to-play (the stage is the play button) ---------- */
/* Clicking a section's stage replays the full algorithm on demand,
   independent of scroll position. The click path does no animation math of
   its own: it reads the exact same per-element @keyframes the scroll path
   generated from the step array (via CSSKeyframesRule) and drives them with
   the Web Animations API over a fixed clock. One renderer, two timelines.
   Works identically in the static fallback, where the same injected
   keyframes drive the same WAAPI calls. */

const CLICK_PLAY_MS = 3000;

function sectionInView(section) {
    const r = section.getBoundingClientRect();
    return r.top < window.innerHeight && r.bottom > 0;
}

/* Find a generated @keyframes rule by name across every stylesheet
   (including the injected section sheets). */
function findKeyframesRule(name) {
    if (!name || name === 'none') return null;
    for (const sheet of document.styleSheets) {
        try {
            const rules = sheet.cssRules;
            for (let i = 0; i < rules.length; i++) {
                if (rules[i].type === CSSRule.KEYFRAMES_RULE && rules[i].name === name) return rules[i];
            }
        } catch (e) {
            /* cross-origin stylesheet — skip */
        }
    }
    return null;
}

/* Turn a generated @keyframes rule into a WAAPI keyframe list. The scroll
   path and the click path therefore consume the same rendered frames. */
function collectKeyframes(el, name) {
    const rule = findKeyframesRule(name);
    if (!rule) return null;
    const props = {
        left: 'left',
        background: 'background',
        transform: 'transform',
        'clip-path': 'clipPath',
        opacity: 'opacity',
        'z-index': 'zIndex',
    };
    return Array.from(rule.cssRules).map(fr => {
        const kf = { offset: fr.offset };
        Object.keys(props).forEach(cssProp => {
            const v = fr.style.getPropertyValue(cssProp);
            if (v !== '') kf[props[cssProp]] = v;
        });
        return kf;
    });
}

/* The elements a playback drives and the generated rule each one uses. */
function playbackTargets(spec) {
    const targets = [];
    Array.from(spec.field.children).forEach((el, i) => {
        targets.push([el, spec.dynamic === 'sort'
            ? `${spec.algorithm}-shard-${i}`
            : `${spec.algorithm}-path-cell-${el.dataset.r}-${el.dataset.c}`]);
    });
    (spec.overlays || []).forEach(ov => {
        const el = document.getElementById(ov.id);
        if (el) targets.push([el, ov.rule]);
    });
    return targets;
}

function registerClickToPlay(spec) {
    const play = Object.assign({
        running: false,
        finished: false,
        superseded: false,
        anims: [],
        plays: 0,
        ignored: 0,
    }, spec);
    NarrativeState.playback.set(spec.algorithm, play);
    return play;
}

function getPlayState(algorithm) {
    const play = NarrativeState.playback.get(algorithm);
    if (!play) return null;
    return { running: play.running, finished: play.finished, plays: play.plays, ignored: play.ignored };
}

function cancelClickToPlay(spec) {
    spec.anims.forEach(a => {
        try { a.cancel(); } catch (e) { /* animation already gone */ }
    });
    spec.anims = [];
    spec.running = false;
    spec.finished = false;
}

function triggerClickToPlay(spec) {
    if (spec.running) {
        spec.ignored += 1;
        return;
    }
    /* Clicks only register while the section is actually in the viewport. */
    if (!sectionInView(spec.section)) return;

    cancelClickToPlay(spec);

    /* The scroll-mode bars are built once from the original array and keep
       their scroll-animation bindings forever — never rebuild them. Only the
       static fallback swaps field children (at-rest settled rebuild), so a
       replay there must restore the original array first. */
    if (!NarrativeState.scrollSupported && spec.dynamic === 'sort') {
        spec.field.classList.remove('shard-field--static-settled');
        buildActIShardField(spec.field, spec.array, spec.shardClass);
    }

    spec.section.classList.add('is-playing');
    spec.plays += 1;
    spec.running = true;
    spec.finished = false;
    spec.superseded = false;

    spec.anims = playbackTargets(spec)
        .map(([el, name]) => {
            const frames = collectKeyframes(el, name);
            return frames && frames.length
                ? el.animate(frames, { duration: CLICK_PLAY_MS, easing: 'linear', fill: 'both' })
                : null;
        })
        .filter(a => a);

    setTimeout(() => finishClickToPlay(spec), CLICK_PLAY_MS);
}

/* When the click play's clock runs out: if a scroll already took over
   (spec.superseded, cancelClickToPlay already unhooked the play) or the
   section left the viewport, make sure nothing holds a stale fill and the
   scroll-driven animation (or the static settled field) drives again.
   Otherwise hold the finished fill so the result stays visible until the
   user scrolls it. */
function finishClickToPlay(spec) {
    if (!spec.running) return;
    spec.running = false;
    spec.section.classList.remove('is-playing');
    if (spec.superseded || !sectionInView(spec.section)) {
        cancelClickToPlay(spec);
        restoreStaticSettled(spec);
    } else {
        spec.finished = true;
    }
}

/* In the static fallback there is no scroll animation to hand control back
   to, so a cancelled play returns the sort fields to their settled-array
   rest state (the same builder the at-rest fallback uses). */
function restoreStaticSettled(spec) {
    if (!NarrativeState.scrollSupported && spec.dynamic === 'sort') {
        settleStaticField(spec.field.id);
    }
}

function bindStageClick(spec) {
    const stage = spec.stage;
    if (!stage || stage.dataset.clickBound) return;
    stage.dataset.clickBound = '1';
    stage.addEventListener('click', () => triggerClickToPlay(spec));
    stage.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            triggerClickToPlay(spec);
        }
    });
}

function bindAllClickToPlay() {
    NarrativeState.playback.forEach(bindStageClick);
    setupPlaybackScrollReset();
}

/* Most-recent-trigger-wins: a scroll event after a click makes scroll the
   active driver again. A running play is cancelled immediately so the
   shards never keep following the play clock after the user scrolls —
   the play's late frames would otherwise render a sorted-looking state at
   an early scroll position until the play timed out. A finished play's
   held fill is likewise cancelled so the section tracks scroll again. */
let playbackScrollTick = false;
function setupPlaybackScrollReset() {
    window.addEventListener('scroll', () => {
        if (playbackScrollTick) return;
        playbackScrollTick = true;
        requestAnimationFrame(() => {
            playbackScrollTick = false;
            NarrativeState.playback.forEach(spec => {
                if (spec.running) {
                    spec.superseded = true;
                    cancelClickToPlay(spec);
                    spec.section.classList.remove('is-playing');
                    restoreStaticSettled(spec);
                    return;
                }
                if (spec.finished) {
                    cancelClickToPlay(spec);
                    restoreStaticSettled(spec);
                }
            });
        });
    }, { passive: true });
}

document.addEventListener('DOMContentLoaded', () => {
    initializeNarrative();
});

window.NarrativeController = {
    initialize: initializeNarrative,
    initializeGeodeHero,
    setupBubbleSortAnimations,
    setupSelectionSortAnimations,
    setupInsertionSortAnimations,
    generateBubbleKeyframes,
    generateSelectionKeyframes,
    generateInsertionKeyframes,
    renderNarrationSteps,
    setupMergeSortAnimations,
    setupQuickSortAnimations,
    generateMergeKeyframes2,
    generateQuickKeyframes,
    setupPathfindingGrid,
    generatePathCellKeyframes,
    generateBFSHaloKeyframes,
    generateAStarTiltKeyframes,
    buildPathGrid,
    setupFooterAnimations,
    applyStaticFallback,
    buildStaticSettledFields,
    settleStaticField,
    setupNarrationKeyboardNav,
    CLICK_PLAY_MS,
    getPlayState,
    triggerClickToPlay,
    registerClickToPlay,
};
