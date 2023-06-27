const { updateAccount } = require("../db/account");

const bannedAccount = async (page, accountId) => {
  await page.waitForSelector(".qr-loading", { state: "hidden" });

  const hasQr = await page.$(".qr-container");

  if (hasQr) {
    await updateAccount(accountId, { banned: true });
    throw new Error("Аккаунт в бане");
  }
};

module.exports = { bannedAccount };
