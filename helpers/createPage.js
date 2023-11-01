const { readAccount } = require("../db/account");

const createPage = async (context, username) => {
  if (!context) {
    throw new Error("Произошла ошибка, context не был передан");
  }
  const {
    localStorage: localStorageData,
    banned,
    defaultLocalStorage,
  } = (await readAccount(username)) ?? {};

  const page = await context.newPage();

  const dataToSetInLocalStorage =
    banned && defaultLocalStorage ? defaultLocalStorage : localStorageData;

  await page.addInitScript((data) => {
    for (let key in data) {
      localStorage.setItem(key, data[key]);
    }
  }, dataToSetInLocalStorage);

  return page;
};

module.exports = { createPage };
