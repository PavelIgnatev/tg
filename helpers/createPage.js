const { readAccount } = require("../db/account");

const createPage = async (context, username) => {
  if (!context) {
    throw new Error("Произошла ошибка, context не был передан");
  }
  const {
    localStorage: localStorageData,
    forceBanned,
    defaultLocalStorage,
  } = (await readAccount(username)) ?? {};

  const page = await context.newPage();

  page.on("domcontentloaded", async () => {
    try {
      if (forceBanned && defaultLocalStorage) {
        await page.evaluate((data) => {
          for (let key in data) {
            localStorage.setItem(key, data[key]);
          }
        }, defaultLocalStorage);
      } else {
        await page.evaluate((data) => {
          for (let key in data) {
            localStorage.setItem(key, data[key]);
          }
        }, localStorageData);
      }
    } catch {}
  });

  return page;
};

module.exports = { createPage };
