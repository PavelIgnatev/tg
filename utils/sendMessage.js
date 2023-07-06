const sendMessage = async (page, message) => {
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

  try {
    await page.waitForSelector(`.Message:has-text("${filtredMessage}")`);
    await page.waitForSelector(
      `.Message:last-child .icon-message-succeeded, .Message:last-child .icon-message-read`
    );
  } catch (e) {
    console.log(e.message);
    throw new Error("Сообщение не доставлено");
  }

  try {
    const fullUserName = await page.waitForSelector(
      ".chat-info-wrapper .fullName"
    );
    const fullUserNameText = await fullUserName.textContent();

    const element = await page.waitForSelector(
      `.ListItem.Chat:has-text("${fullUserNameText}")`
    );

    await page.keyboard.down("Control");
    await element.click();
    await page.keyboard.up("Control");

    await page.waitForTimeout(3500);

    const archive = await page.waitForSelector(
      '.MenuItem.compact:has-text("Archive")'
    );
    await archive.click();
  } catch (e) {
    console.log(e.message);
  }

  await page.waitForSelector(`.ListItem.Chat:has-text("Telegram")`);
};

module.exports = { sendMessage };
