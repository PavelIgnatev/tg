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

const main = async (accountId) => {
  if (!accountId) {
    throw new Error("Произошла ошибка, accountId не был передан");
  }

  const [context, browser] = await initialBrowser(true, accountId);
  const page = await createPage(context, accountId);

  try {
    await page.goto("https://web.telegram.org/a/");
    await page.waitForLoadState("networkidle");

    console.log('Аккаунт загружен')

    const isSpam = await checkSpam(accountId, context);
    await accountSetup(page, accountId);

    const { name: aiName, aiUsername } = await getMyName(page, accountId);

    await autoResponse(page, aiName, aiUsername);

    // делаем отправку только в случае, если аккаунт не в спаме
    if (!isSpam) {
      await autoSender(accountId, context, aiUsername);
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

          await main(username);
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
