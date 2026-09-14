const { chromium } = require('playwright');
const { pathToFileURL } = require('node:url');
const path = require('path');
const FILE = pathToFileURL(path.join(__dirname, '..', 'index.html')).href;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('ERROR:', err.message));
  
  await page.goto(FILE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  // Check CSS.supports for animation-timeline
  const supports = await page.evaluate(() => {
    return {
      viewTimeline: CSS.supports('animation-timeline', 'view()'),
      viewTimelineNamed: CSS.supports('animation-timeline', 'view(--test)'),
      scrollTimeline: CSS.supports('animation-timeline', 'scroll()'),
    };
  });
  console.log('CSS.supports results:', supports);
  
  // Check if @supports rule is active
  const supportsRule = await page.evaluate(() => {
    const sheets = Array.from(document.styleSheets);
    for (const sheet of sheets) {
      try {
        const rules = Array.from(sheet.cssRules || []);
        for (const rule of rules) {
          if (rule.type === CSSRule.SUPPORTS_RULE) {
            console.log('Found @supports rule:', rule.conditionText);
          }
        }
      } catch (e) {
        // Cross-origin stylesheet
      }
    }
  });
  
  await browser.close();
})();
