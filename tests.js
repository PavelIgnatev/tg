// The stealth plugin is optimized for chromium based browsers currently
const { chromium } = require("playwright-extra");
const stealth = require("puppeteer-extra-plugin-stealth");

const shromiumStealth = stealth();

chromium.use(shromiumStealth);

// New way to overwrite the default options of stealth evasion plugins
// https://github.com/berstend/puppeteer-extra/tree/master/packages/puppeteer-extra-plugin-stealth/evasions
chromium.plugins.setDependencyDefaults("stealth/evasions/webgl.vendor", {
  vendor: "Bob",
  renderer: "Alice",
});

// That's it, the rest is playwright usage as normal 😊
chromium.launch({ headless: true }).then(async (browser) => {
  const page = await browser.newPage();

  console.log("Testing the webgl spoofing feature of the stealth plugin..");
  await page.goto("https://webglreport.com", { waitUntil: "networkidle" });
  await page.screenshot({ path: "webgl.png", fullPage: true });

  console.log("All done, check the screenshot. ✨");
  await browser.close();
});
