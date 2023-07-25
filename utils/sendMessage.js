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
  } catch (e) {
    console.log(e.message);
    throw new Error("Сообщение не доставлено");
  }
};

module.exports = { sendMessage };
