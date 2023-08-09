const sendMessage = async (page, message) => {
  try {
    const filtredMessage = message.replace(/\n/g, "").replace(/['"`]/g, "");
    const input = await page.waitForSelector("#editable-message-text", {
      state: "attached",
    });

    await input.type("         " + filtredMessage, { delay: 10 });

    const buttonElement = await page.waitForSelector(
      'button[title="Send Message"]',
      {
        state: "attached",
      }
    );

    await buttonElement.click();
  } catch (e) {
    console.log(e.message);
    throw new Error("Сообщение не доставлено");
  }
};

module.exports = { sendMessage };
