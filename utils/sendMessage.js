const sendMessage = async (page, message) => {
  const filtredMessage = message.replace(/\n/g, "").replace(/['"`]/g, "");
  const input = await page.waitForSelector("#editable-message-text", {
    state: "attached",
  });

  await input.type("         " + filtredMessage);

  const buttonElement = await page.waitForSelector(
    'button[title="Send Message"]',
    {
      state: "attached",
    }
  );

  await buttonElement.click();

  try {
    await page.waitForTimeout(2500);
    const element = await page.waitForSelector(
      `.Message:has-text("${filtredMessage}")`
    );
    await page.waitForTimeout(2500);
    await element.waitForSelector(
      `.icon-message-succeeded, .icon-message-read`
    );
  } catch (e) {
    console.log(e.message);
    throw new Error("Сообщение не доставлено");
  }
};

module.exports = { sendMessage };
