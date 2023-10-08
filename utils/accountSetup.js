const { updateAccount, readAccount } = require("../db/account");
const { replaceRussianLetters } = require("./replaceRussianLetters");

const accountSetup = async (page, accountId) => {
  const { setup } = await readAccount(accountId);

  console.log("Проверяю сетап для аккаунта:", accountId);

  if (setup) {
    console.log("Сетап для пользователя", accountId, "присутствует");

    return;
  }

  console.log("Сетап для пользователя", accountId, "отсутсвует");

  const settingsButton = await page?.waitForSelector(
    ".DropdownMenu.main-menu",
    {
      state: "attached",
    }
  );

  await settingsButton?.click();

  await page.waitForTimeout(3000);

  const settings = await page?.waitForSelector(
    ".MenuItem.compact:has-text('Settings')",
    {
      state: "attached",
    }
  );

  await settings?.click();

  await page.waitForTimeout(3000);

  const notifications = await page?.waitForSelector(
    '.ListItem:has-text("Notifications")'
  );

  await notifications?.click();

  try {
    const notificationsGroups = await page?.waitForSelector(
      '.Checkbox-main:has-text("Notifications for private chats"):has-text("Disabled")',
      {
        state: "attached",
        timeout: 5000,
      }
    );

    await notificationsGroups?.click();
  } catch {}

  try {
    const notificationsGroups = await page?.waitForSelector(
      '.Checkbox-main:has-text("Notifications for groups"):has-text("Enabled")',
      {
        state: "attached",
        timeout: 5000,
      }
    );

    await notificationsGroups?.click();
  } catch {}

  try {
    const notificationsChannels = await page?.waitForSelector(
      '.Checkbox-main:has-text("Notifications for channels"):has-text("Enabled")',
      {
        state: "attached",
        timeout: 5000,
      }
    );

    await notificationsChannels?.click();
  } catch {}

  const buttonElements1 = await page?.$$('button[title="Go back"]');

  await buttonElements1[1].click();

  const buttonElement = await page?.waitForSelector(
    'button[title="Edit profile"]',
    {
      state: "attached",
    }
  );

  await buttonElement?.click();

  const inputName = await page?.waitForSelector(
    'input[aria-label="First name (required)"]',
    {
      state: "attached",
    }
  );

  const inputValue = await inputName?.getProperty("value");
  const name = await inputValue?.jsonValue();

  await page.waitForTimeout(15000);
  const userName = await page.waitForSelector('input[aria-label="Username"]', {
    state: "attached",
  });
  const randomNameInputValue = await userName?.getProperty("value");
  const aiRandomNameValue = await randomNameInputValue?.jsonValue();
  const aiRandomName = `${replaceRussianLetters(name)}_${
    Math.floor(Math.random() * 9e5) + 1e5
  }`;

  try {
    if (!aiRandomNameValue) {
      await userName?.fill(`${aiRandomName}`, { delay: 100 });

      const buttonSave = await page.waitForSelector('button[title="Save"]', {
        state: "attached",
        timeout: 5000,
      });

      await page.waitForTimeout(2000);

      await buttonSave?.click();

      await page.waitForTimeout(5000);

      await page.waitForFunction((button) => !button.disabled, buttonSave);

      await page.waitForTimeout(5000);
    }
  } catch (e) {
    console.log(e);
  }

  const buttonElements = await page?.$$('button[title="Go back"]');

  await buttonElements[1].click();
  await buttonElements[0].click();

  console.log("Создал сетап для аккаунта:", accountId);

  await updateAccount(accountId, {
    setup: true,
    name,
    aiUsername: aiRandomNameValue?.toLowerCase() || aiRandomName?.toLowerCase(),
  });
};

module.exports = { accountSetup };
