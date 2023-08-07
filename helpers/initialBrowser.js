const { chromium } = require("playwright-extra");
const stealth = require("puppeteer-extra-plugin-stealth");

const { readAccount } = require("../db/account");
const { assignAccountId } = require("../db/proxy");

const shromiumStealth = stealth();

shromiumStealth.enabledEvasions.delete("user-agent-override");
chromium.use(shromiumStealth);

chromium.plugins.setDependencyDefaults("stealth/evasions/webgl.vendor", {
  vendor: "Pavel",
  renderer: "Rustom",
});

const initialBrowser = async (headless, username) => {
  const { cookies, userAgent } = (await readAccount(username)) ?? {};
  const {
    server,
    username: serverUsername,
    password,
  } = await assignAccountId(username);

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
      server,
      username: serverUsername,
      password,
    },
  });

  return [context, browser];
};

module.exports = { initialBrowser };
