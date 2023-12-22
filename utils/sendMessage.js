function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

const sendMessage = async (page, message) => {
  try {
    const input = await page.waitForSelector("#editable-message-text", {
      state: "attached",
    });
    const filtredMessage = message.replace(/\n/g, "").replace(/['"`]/g, "");

    const maxId = await page.evaluate(() => {
      const elements = document.querySelectorAll("[data-message-id]");
      return Math.max(
        ...Array.from(elements)
          .map((element) => element.getAttribute("data-message-id"))
          .map((e) => Math.floor(Number(e))),
        -1
      );
    });

    await input.type("         " + capitalizeFirstLetter(filtredMessage), {
      delay: 15,
      timeout: 60000,
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

    // await page.waitForSelector(`[data-message-id='${maxId + 1}']`);
  } catch (e) {
    console.log(e.message);
    throw new Error("Сообщение не доставлено");
  }
};

module.exports = { sendMessage };
