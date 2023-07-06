const { createPage } = require("./helpers/createPage");
const { destroyBrowser } = require("./helpers/destroyBrowser");
const { initialBrowser } = require("./helpers/initialBrowser");
const { autoResponse } = require("./modules/autoResponse");
const { getAllUsernames, updateAccount } = require("./db/account");
const { default: axios } = require("axios");
const { autoSender } = require("./modules/autoSender");
const { accountSetup } = require("./utils/accountSetup");
const { changeProxy } = require("./utils/changeProxy");

const main = async (username) => {
  if (!username) {
    throw new Error("Произошла ошибка, username не был передан");
  }

  const [context, browser] = await initialBrowser(true, username);
  const page = await createPage(context, username);

  try {
    await page.goto("https://web.telegram.org/a/");
    await page.waitForLoadState("networkidle");

    await accountSetup(page, username);

    await autoResponse(page);

    await autoSender(page, username);

    try {
      console.log("Аккаунт не в бане");
      await updateAccount(username, { banned: false });
    } catch {}
  } catch (e) {
    console.log(e.message);

    if (e.message?.includes("DropdownMenu.main-menu")) {
      console.log("Аккаунт в бане");
      await updateAccount(username, { banned: true });
    }
  }

  try {
    await destroyBrowser(username, page, context, browser);
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
        console.time("startMainLoop"); 

        try {
          await changeProxy();

          console.log("Начинаю вход в аккаунт: ", username);

          await main(username);
        } catch (error) {
          console.error(
            `Ошибка обработки для пользователя ${username}: ${error}`
          );
        }
        console.timeEnd("startMainLoop");
      }
    } catch (e) {
      console.log(e.message, "ошибка в цикле");
    }
  }
};

startMainLoop();
