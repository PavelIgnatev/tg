const checkSpam = async (page) => {
  const searchInput = await page.waitForSelector("#telegram-search-input", {
    state: "attached",
  });

  await searchInput.click();

  await searchInput.type("spambot");

  await page.waitForSelector(".ListItem.search-result", {
    state: "attached",
  });
  await page.waitForSelector(".Button.tiny.translucent.round", {
    state: "attached",
  });

  await page.keyboard.press("Enter");

  const input = await page.waitForSelector("#editable-message-text", {
    state: "attached",
  });

  await input.type("/start", { delay: 10 });

  const buttonElement = await page.waitForSelector(
    'button[title="Send Message"]',
    {
      state: "attached",
    }
  );

  await buttonElement.click();

  const botResponseEl = await page.waitForSelector(
    ".last-in-list:has-text('I’m afraid some Telegram users found your messages annoying and forwarded them to our team'), .last-in-list:has-text('Good news, no limits are currently applied to your account')"
  );

  const botResponse = await botResponseEl.textContent();

  if (
    botResponse?.includes(
      "Good news, no limits are currently applied to your account"
    )
  ) {
    return false;
  }

  return true;
};
module.exports = { checkSpam };
