const { createPage } = require("./helpers/createPage");
const { destroyBrowser } = require("./helpers/destroyBrowser");
const { initialBrowser } = require("./helpers/initialBrowser");
const { autoResponse } = require("./modules/autoResponse");
const { autoSender } = require("./modules/autoSender");
const { accountSetup } = require("./utils/accountSetup");
const { checkBanned } = require("./modules/checkBanned");
const { changeProxy } = require("./utils/changeProxy");
const { getCurrentAccount } = require("./db/account");
const util = require("util");
const exec = util.promisify(require("child_process").exec);

const main = async (accountId) => {
  if (!accountId) {
    throw new Error("Произошла ошибка, accountId не был передан");
  }

  const [context, browser] = await initialBrowser(true, accountId);
  const page = await createPage(context, accountId);

  try {
    await page.goto("https://web.telegram.org/a/");
    await page.waitForLoadState();

    await page.reload();
    await page.waitForLoadState();

    await page.waitForTimeout(100000);

    const isBanned = await checkBanned(page, accountId);

    if (isBanned) {
      throw new Error("Аккаунт забанен");
    }

    // если лоадер есть - ждем исчезновения
    try {
      await page.waitForSelector(".Spinner__inner", { state: "hidden" });
    } catch {
      throw new Error("Спиннер есть, хотя не должен ");
    }

    console.log("Аккаунт инициализирован");
    await accountSetup(page, accountId);

    await autoResponse(page, context, accountId);

    await autoSender(accountId, context);
  } catch (e) {
    console.error(e.message);
  }

  try {
    await destroyBrowser(accountId, page, context, browser);
    return;
  } catch {
    console.log('Ошибка при закрытии браузера "destroyBrowser"');
  }

  try {
    await browser.close();
  } catch {
    console.log('Ошибка при закрытии браузера "browser.close()"');
  }
};

const startMainLoop = async () => {
  const threadCount = 3;
  const promises = [];

  await changeProxy();

  for (let i = 0; i < threadCount; i++) {
    promises.push(
      (async () => {
        try {
          console.time(`Время, потраченное на обработку аккаунта ${i}`);
          const username = await getCurrentAccount();
          // отправка без звуука
          try {
            console.log("Начинаю вход в аккаунт: ", username);

            await main(username);
          } catch (error) {
            console.error(
              `Ошибка обработки для пользователя ${username}: ${error}`
            );
          }

          console.timeEnd(`Время, потраченное на обработку аккаунта ${i}`);
        } catch (e) {
          console.log(e.message, "ошибка в цикле");
        }
      })()
    );
  }

  await Promise.allSettled(promises);
};

(async () => {
  try {
    await startMainLoop();
    await exec("pm2 restart telegram");
  } catch (e) {
    console.log(e.message);
    await exec("pm2 restart telegram");
  }
})();
