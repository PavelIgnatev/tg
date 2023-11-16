const checkSpam = async (context) => {
  try {
    const newPage = await context.newPage();

    await newPage.goto(
      `https://web.telegram.org/a/#?tgaddr=tg%3A%2F%2Fresolve%3Fdomain%3Dspambot`,
      {
        timeout: 60000,
      }
    );
    await newPage.waitForLoadState();

    try {
      const buttonStart = await newPage.waitForSelector(
        'button:has-text("Start")',
        {
          timeout: 7500,
        }
      );

      await buttonStart.click();
    } catch {
      try {
        const input = await newPage.waitForSelector("#editable-message-text", {
          state: "attached",
        });

        await input.type("/start", { delay: 10 });
      } catch {
        return "banned";
      }

      const buttonElement = await newPage.waitForSelector(
        'button[title="Send Message"]',
        {
          state: "attached",
        }
      );

      await buttonElement.click();
    }

    await newPage.waitForSelector('.last-in-list:has-text("/start")', {
      state: "hidden",
    });
    await newPage.waitForTimeout(5000);
    const botResponseEl = await newPage.waitForSelector(".last-in-list");

    const botResponse = await botResponseEl.textContent();

    console.log(
      `\x1b[4mОтвет от spambot:\x1b[0m \x1b[36m${botResponse}\x1b[0m`
    );
    await newPage.close();

    if (
      botResponse?.includes(
        "Good news, no limits are currently applied to your account"
      ) ||
      botResponse?.includes("Ваш аккаунт свободен от каких-либо ограничений.")
    ) {
      console.log("Аккаунт не имеет спамблока");
      return false;
    }

    console.log("Аккаунт имеет спамблок");
    return true;
  } catch (e) {
    console.log(e.message);
    console.log("Аккаунт имеет спамблок");
    return true;
  }
};

module.exports = { checkSpam };
