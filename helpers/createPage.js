const { readAccount } = require("../db/account");

const createPage = async (context, username) => {
  if (!context) {
    throw new Error("Произошла ошибка, context не был передан");
  }
  const {
    localStorage: localStorageData,
    defaultLocalStorage,
    forceBanned,
  } = (await readAccount(username)) ?? {};

  const page = await context.newPage();

  const ls = forceBanned ? defaultLocalStorage : localStorageData;

  await page.addInitScript((localStorageData) => {
    for (let key in localStorageData) {
      localStorage.setItem(key, localStorageData[key]);
    }
  }, ls);

  return page;
};

module.exports = { createPage };
