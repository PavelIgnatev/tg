const { readAccount } = require("../db/account");

const createPage = async (context, username) => {
  if (!context) {
    throw new Error("Произошла ошибка, context не был передан");
  }
  const { localStorage: localStorageData } =
    (await readAccount(username)) ?? {};

  const page = await context.newPage();

  await page.addInitScript((localStorageData) => {
    console.log('init')
    for (let key in localStorageData) {
      localStorage.setItem(key, localStorageData[key]);
    }
  }, localStorageData);

  return page;
};

module.exports = { createPage };
