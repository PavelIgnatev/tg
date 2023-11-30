function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

const sendMessage = async (page, message) => {
  try {
    const filtredMessage = message.replace(/\n/g, "").replace(/['"`]/g, "");
    const input = await page.waitForSelector("#editable-message-text", {
      state: "attached",
    });

    await input.type("         " + capitalizeFirstLetter(filtredMessage), {
      delay: 10,
    });

    const buttonElement = await page.waitForSelector(
      'button[title="Send Message"]',
      {
        state: "attached",
      }
    );

    await buttonElement.click({ force: true });
    await input.type("", { delay: 10 });
    await input.type("", { delay: 10 });
    await input.type("", { delay: 10 });
    await page.waitForTimeout(1000);
  } catch (e) {
    console.log(e.message);
    throw new Error("Сообщение не доставлено");
  }
};

module.exports = { sendMessage };
