const { searchByUsername } = require("./searchByUsername");

const sendMessage = async (page, message) => {
  const input = await page.waitForSelector("#editable-message-text", {
    state: "attached",
  });

  await input.type(("         " + message.replace(/\n/g, '')).replace(/"/g, ""), { delay: 10 });

  const buttonElement = await page.waitForSelector(
    'button[title="Send Message"]',
    {
      state: "attached",
    }
  );

  await buttonElement.click();

  try {
    await page.waitForSelector(`.Message:has-text("${message}")`);
    await page.waitForSelector(
      `.Message:last-child .icon-message-succeeded, .Message:last-child .icon-message-read`
    );
  } catch (e) {
    console.log(e);
    throw new Error("Сообщение не доставлено");
  }

  const fullUserName = await page.waitForSelector(
    ".chat-info-wrapper .fullName"
  );
  const fullUserNameText = await fullUserName.textContent();

  const element = await page.waitForSelector(
    `.ListItem.Chat:has-text("${fullUserNameText}")`
  );

  await element.click({ modifiers: ["Control"] });

  const archive = await page.waitForSelector(
    '.MenuItem.compact:has-text("Archive")'
  );
  await archive.click();

  await page.waitForSelector(
    `.ListItem.Chat:has-text("Telegram")`
  );
};

module.exports = { sendMessage };
