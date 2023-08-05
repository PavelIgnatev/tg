const { accountSetup } = require("../utils/accountSetup");

const getMyName = async (page, accountId) => {
  const settingsButton = await page?.waitForSelector(
    ".DropdownMenu.main-menu",
    {
      state: "attached",
    }
  );

  await settingsButton?.click();

  const settings = await page?.waitForSelector(
    ".MenuItem.compact:has-text('Settings')",
    {
      state: "attached",
    }
  );

  await settings?.click();

  const buttonElement = await page?.waitForSelector(
    'button[title="Edit profile"]',
    {
      state: "attached",
    }
  );

  await buttonElement?.click();

  await page.waitForTimeout(4000);

  const inputName = await page?.waitForSelector(
    'input[aria-label="First name (required)"]',
    {
      state: "attached",
    }
  );

  const aiUsernameEl = await page?.waitForSelector(
    'input[aria-label="Username"]',
    {
      state: "attached",
    }
  );

  const inputValue = await inputName?.getProperty("value");
  const name = await inputValue?.jsonValue();
  const aiUsernameValue = await aiUsernameEl?.getProperty("value");
  const aiUsername = await aiUsernameValue?.jsonValue();

  const buttonElements = await page?.$$('button[title="Go back"]');

  await buttonElements[1].click();
  await buttonElements[0].click();

  if (!aiUsername) {
    await accountSetup(page, accountId);
    throw new Error("AiUsername не найден");
  }

  return { name: name.trim().length > 0 ? name : "Менеджер", aiUsername };
};

module.exports = { getMyName };
