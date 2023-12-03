const { updateAccount } = require("../db/account");

const checkBanned = async (page, accountId) => {
  try {
    const spinnerSelector = ".Spinner__inner";

    try {
      await page.waitForSelector(spinnerSelector);
      await page.waitForSelector(spinnerSelector, {
        state: "hidden",
      });
    } catch {
      await updateAccount(accountId, { banned: true });

      return true;
    }

    try {
      await page.waitForSelector("#telegram-search-input", { timeout: 5000 });
    } catch {
      await updateAccount(accountId, { banned: true });

      return true;
    }

    try {
      const itsMe = await page.waitForSelector(
        `button:has-text("Yes, it's me")`,
        { timeout: 1500, force: true }
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
  await updateAccount(accountId, {
    banned: false,
    forceBanned: false,
    fullBanned: false,
  });
  return false;
};

module.exports = { checkBanned };
