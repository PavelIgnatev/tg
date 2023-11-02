const { updateAccount } = require("../db/account");

const checkBanned = async (page, accountId) => {
  try {
    const spinnerSelector = ".Spinner__inner";

    try {
      await page.waitForSelector(spinnerSelector);
      await page.waitForSelector(spinnerSelector, {
        state: "hidden",
      });
    } catch {}

    try {
      const itsMe = await page.waitForSelector(
        `button:has-text("Yes, it's me")`,
        { timeout: 1500 }
      );
      await itsMe.click();
    } catch {}

    const isBanned = await page.$(".auth-form");

    if (isBanned) {
      await updateAccount(accountId, { banned: true });

      return true;
    }
  } catch (e) {
    console.log(e.message);
  }

  console.log("Аккаунт свободен от бана");
  await updateAccount(accountId, { banned: false, forceBanned: false });
  return false;
};

module.exports = { checkBanned };
