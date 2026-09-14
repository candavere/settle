const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('ERROR:', err.message));
  
  await page.goto('file:///Users/amarmehta/Documents/settle/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  // Scroll to merge section
  await page.evaluate(() => window.scrollTo(0, 3000));
  await page.waitForTimeout(500);
  
  // Tab through narration steps
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);
    const focused = await page.evaluate(() => {
      const el = document.activeElement;
      return el ? `${el.tagName}.${el.className} (${el.id})` : 'none';
    });
    console.log(`Tab ${i+1}: ${focused}`);
  }
  
  // Test Enter/Space on a narration step
  const step = await page.locator('#narration-merge .narration-step').first();
  await step.focus();
  await page.waitForTimeout(100);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  console.log('After Enter on narration step');
  
  await browser.close();
})();
