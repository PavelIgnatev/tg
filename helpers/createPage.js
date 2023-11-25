const { readAccount } = require("../db/account");

const createPage = async (context, username) => {
  if (!context) {
    throw new Error("Произошла ошибка, context не был передан");
  }
  const { defaultLocalStorage } = (await readAccount(username)) ?? {};

  const page = await context.newPage();

  await page.addInitScript((localStorageData) => {
    for (let key in localStorageData) {
      localStorage.setItem(key, localStorageData[key]);
    }
  }, defaultLocalStorage);

  return page;
};

module.exports = { createPage };
