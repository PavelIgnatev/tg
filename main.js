const { createPage } = require("./helpers/createPage");
const { destroyBrowser } = require("./helpers/destroyBrowser");
const { initialBrowser } = require("./helpers/initialBrowser");
const { autoResponse } = require("./modules/autoResponse");
const { getAllUsernames, updateAccount } = require("./db/account");
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

  const [context, browser] = await initialBrowser(false, accountId);
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

function randomSort(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

const startMainLoop = async () => {
  while (true) {
    try {
      const usernames = await getAllUsernames();

      console.log(usernames);
      for (const username of randomSort(usernames)) {
        console.time("Время, потраченное на обработку аккаунта");

        try {
          await changeProxy();

          console.log("Начинаю вход в аккаунт: ", username);

          await main(17765899239);
        } catch (error) {
          console.error(
            `Ошибка обработки для пользователя ${username}: ${error}`
          );
        }
        console.timeEnd("Время, потраченное на обработку аккаунта");
      }
    } catch (e) {
      console.log(e.message, "ошибка в цикле");
    }
  }
};

startMainLoop();
