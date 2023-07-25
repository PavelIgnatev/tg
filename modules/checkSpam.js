const { updateAccount } = require("../db/account");

const checkMiniSpam = async (context) => {
  const newPage = await context.newPage();

  await newPage.goto(
    `https://web.telegram.org/a/#?tgaddr=tg%3A%2F%2Fresolve%3Fdomain%3Dspambot`
  );
  await newPage.waitForLoadState("networkidle");

  const input = await newPage.waitForSelector("#editable-message-text", {
    state: "attached",
  });

  await input.type("/start", { delay: 10 });

  const buttonElement = await newPage.waitForSelector(
    'button[title="Send Message"]',
    {
      state: "attached",
    }
  );

  await buttonElement.click();

  await newPage.waitForTimeout(4000);

  const botResponseEl = await newPage.waitForSelector(
    ".last-in-list:has-text('I’m afraid some Telegram users found your messages annoying and forwarded them to our team'), .last-in-list:has-text('Good news, no limits are currently applied to your account')"
  );

  const botResponse = await botResponseEl.textContent();

  await newPage.close();

  if (
    botResponse?.includes(
      "Good news, no limits are currently applied to your account"
    )
  ) {
    return false;
  }

  return true;
};

const checkSpam = async (username, context) => {
  try {
    const isSpam = await checkMiniSpam(context);

    console.log("Взаимодействие с аккаунтом успешно, бана нет");

    if (isSpam) {
      console.log("На аккаунт наложен спамблок");
      await updateAccount(username, { banned: false, spam: true });

      return true;
    } else {
      await updateAccount(username, { banned: false, spam: false });

      return false;
    }
  } catch (e) {
    if (
      e.message?.includes("telegram-search-input") ||
      e.message?.includes(".last-in-list:has-text")
    ) {
      console.log("Взаимодействие с аккаунтом неуспешно, бан есть");

      await updateAccount(username, { banned: true });
    }

    throw new Error(e.message);
  }
};

module.exports = { checkSpam };
