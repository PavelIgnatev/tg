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

    const lastIdPrev = await page.evaluate(async () => {
      let retryCount = 0;
      while (
        !Array.from(document.querySelectorAll("[data-message-id]"))
          .map((e) => e.getAttribute("data-message-id"))
          .filter((e) => e.includes(".")).length > 0
      ) {
        if (retryCount >= 50) {
          break;
        }

        await new Promise((res) => setTimeout(res, 50));
        retryCount++;
      }

      return Math.max(
        ...Array.from(document.querySelectorAll("[data-message-id]"))
          .map((e) => e.getAttribute("data-message-id"))
          .filter((e) => e.includes("."))
          .map(Number)
      );
    });
    console.log(lastIdPrev);
    await page.waitForSelector(`[data-message-id='${lastIdPrev}']`, {
      state: "hidden",
    });
  } catch (e) {
    console.log(e.message);
    throw new Error("Сообщение не доставлено");
  }
};

module.exports = { sendMessage };
