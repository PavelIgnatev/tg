const { createPage } = require("./helpers/createPage");
const { destroyBrowser } = require("./helpers/destroyBrowser");
const { initialBrowser } = require("./helpers/initialBrowser");
const { autoResponse } = require("./modules/autoResponse");
const {
  getAllUsernames,
  updateAccount,
  getCurrentAccount,
} = require("./db/account");
const { default: axios } = require("axios");
const { autoSender } = require("./modules/autoSender");
const { accountSetup } = require("./utils/accountSetup");
const { changeProxy } = require("./utils/changeProxy");
const { checkSpam } = require("./modules/checkSpam");
const { getMyName } = require("./modules/getMyName");
const { checkBanned } = require("./modules/checkBanned");

const main = async (accountId) => {
  if (!accountId) {
    throw new Error("Произошла ошибка, accountId не был передан");
  }

  const [context, browser] = await initialBrowser(true, accountId);
  const page = await createPage(context, accountId);

  try {
    await page.goto("https://web.telegram.org/a/");
    await page.waitForLoadState();

    const isBanned = await checkBanned(page, accountId);

    if (isBanned) {
      throw new Error("Аккаунт забанен");
    }

    const isSpam = await checkSpam(context);

    console.log("Аккаунт инициализирован");
    await accountSetup(page, accountId);

    await autoResponse(page, context, accountId);

    if (!isSpam) {
      await autoSender(accountId, context);
    }
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
  while (true) {
    try {
      console.time("Время, потраченное на обработку аккаунта");
      const username = await getCurrentAccount();
      // вернуть баннед

      try {
        // await changeProxy();
        console.log("Начинаю вход в аккаунт: ", username);

        await main(username);
      } catch (error) {
        console.error(
          `Ошибка обработки для пользователя ${username}: ${error}`
        );
      }

      console.timeEnd("Время, потраченное на обработку аккаунта");
    } catch (e) {
      console.log(e.message, "ошибка в цикле");
    }
  }
};

startMainLoop();
