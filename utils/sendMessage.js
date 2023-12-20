function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

const sendMessage = async (page, message) => {
  try {
    const filtredMessage = message.replace(/\n/g, "").replace(/['"`]/g, "");

    await page.waitForTimeout(1000);
    const input = await page.waitForSelector("#editable-message-text", {
      state: "attached",
    });
    await input.type("         " + capitalizeFirstLetter(filtredMessage), {
      delay: 25,
      timeout: 60000,
    });

    await page.waitForTimeout(1000);
    const buttonElement = await page.waitForSelector(
      'button[title="Send Message"]',
      {
        state: "attached",
      }
    );
    await buttonElement.click({ force: true });

    await page.waitForTimeout(500);
    await input.type("", { delay: 10 });
    await input.type("", { delay: 10 });
    await input.type("", { delay: 10 });
    await page.waitForTimeout(500);
  } catch (e) {
    console.log(e.message);
    throw new Error("Сообщение не доставлено");
  }
};

module.exports = { sendMessage };
