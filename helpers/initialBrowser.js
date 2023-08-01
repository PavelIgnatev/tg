const { chromium } = require("playwright-extra");
const stealth = require("puppeteer-extra-plugin-stealth");

const { readAccount } = require("../db/account");

const shromiumStealth = stealth();

shromiumStealth.enabledEvasions.delete("user-agent-override");
chromium.use(shromiumStealth);

chromium.plugins.setDependencyDefaults("stealth/evasions/webgl.vendor", {
  vendor: "Pavel",
  renderer: "Rustom",
});

const initialBrowser = async (headless, username) => {
  const { cookies, userAgent } = (await readAccount(username)) ?? {};

  const browser = await chromium.launch({
    headless: headless,
  });

  const context = await browser.newContext({
    userAgent,

    cursor: "default",
    storageState: {
      cookies,
    },
    proxy: {
      server: "217.29.63.159:13219",
      username: "DDD7gJ",
      password: "80mHKn",
    },
  });

  return [context, browser];
};

module.exports = { initialBrowser };
