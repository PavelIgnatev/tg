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
    ignoreDefaultArgs: [
      "--enable-automation",
      "--disable-extensions",
      "--disable-plugins",
      "--disable-extensions-file-access-check",
      "--disable-site-isolation-trials",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
    defaultViewport: null,
    userDataDir: null,
    devtools: false,
    ignoreHTTPSErrors: true,
  });

  const context = await browser.newContext({
    userAgent,
    cursor: "default",
    storageState: {
      cookies,
    },
    proxy: {
      server: "dproxy.site:17324",
      username: "yB4aBA",
      password: "aFbuKENruX5Y",
    },
  });

  return [context, browser];
};

module.exports = { initialBrowser };
