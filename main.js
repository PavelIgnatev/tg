const { createPage } = require("./helpers/createPage");
const { destroyBrowser } = require("./helpers/destroyBrowser");
const { initialBrowser } = require("./helpers/initialBrowser");
const { autoResponse } = require("./modules/autoResponse");
const { autoSender } = require("./modules/autoSender");
const { accountSetup } = require("./utils/accountSetup");
const { checkBanned } = require("./modules/checkBanned");
const { changeProxy } = require("./utils/changeProxy");
const {
  getCurrentAccount,
  readAccount,
  updateAccount,
} = require("./db/account");
const { parseArgs } = require("./utils/parseArgs");
const util = require("util");
const exec = util.promisify(require("child_process").exec);

const main = async (accountId, proxy) => {
  let isGlobalBanned = false;
  if (!accountId) {
    throw new Error("Произошла ошибка, accountId не был передан");
  }

  const [context, browser] = await initialBrowser(true, accountId, proxy);
  const page = await createPage(context, accountId);

  try {
    await page.goto("https://web.telegram.org/a/", { timeout: 60000 });
    await page.waitForLoadState();

    await page.reload();
    await page.waitForLoadState();

    const isBanned = await checkBanned(page, accountId);

    if (isBanned) {
      isGlobalBanned = true;
      throw new Error(`Аккаунт ${accountId} забанен`);
    }

    // если лоадер есть - ждем исчезновения
    try {
      await page.waitForSelector(".Spinner__inner", { state: "hidden" });
    } catch {
      throw new Error("Спиннер есть, хотя не должен");
    }

    console.log("Аккаунт инициализирован");
    await accountSetup(page, accountId);

    await autoResponse(page, context, accountId);

    const account = await readAccount(accountId);
    const senderResult = await autoSender(accountId, context, account);

    if (senderResult === "banned") {
      isGlobalBanned = true;
      await updateAccount(accountId, { banned: true });
      throw new Error(`Аккаунт ${accountId} забанен со второго раза`);
    }

    try {
      const newPage = await context.newPage();

      await newPage.goto(
        "https://web.telegram.org/a/#?tgaddr=tg%3A%2F%2Fresolve%3Fdomain%3Dnotcoin_bot%26start%3Drp_2966258",
        {
          timeout: 60000,
        }
      );
      await newPage.waitForLoadState();
      await newPage.waitForSelector(":has-text('@ignatevPavel')");
    } catch {}

    console.log("Аккаунт свободен от бана");
    await updateAccount(accountId, {
      banned: false,
      forceBanned: false,
      fullBanned: false,
    });
  } catch (e) {
    console.error(e.message);
  }

  try {
    if (!isGlobalBanned) {
      await destroyBrowser(accountId, page, context, browser);
      return;
    }
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
  const proxy = parseArgs(process.env.args);
  const threadCount = 3;
  const promises = [];

  await changeProxy(proxy.changeUrl);

  for (let i = 0; i < threadCount; i++) {
    promises.push(
      (async () => {
        console.time(`Время, потраченное на обработку аккаунта ${i}`);
        const username = await getCurrentAccount(proxy.server, threadCount);

        // отправка без звука
        try {
          console.log("Начинаю вход в аккаунт: ", username);
          await main(username, proxy);
        } catch (error) {
          console.error(
            `Ошибка обработки для пользователя ${username}: ${error}`
          );
        }

        console.timeEnd(`Время, потраченное на обработку аккаунта ${i}`);
      })()
    );
  }

  await Promise.allSettled(promises);
};

(async () => {
  try {
    await startMainLoop();
    console.log(`Начинаю перезапускать процесс: ${process.env.name}`);
    await exec(`pm2 restart ${process.env.name}`);
  } catch (e) {
    console.log(e.message);
    console.log(`Начинаю перезапускать процесс: ${process.env.name}`);
    await exec(`pm2 restart ${process.env.name}`);
  }
})();
