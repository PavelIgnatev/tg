const { updateAccount, readAccount } = require("../db/account");
const { getRandomName } = require("./getRandomName");
const { getRandomImageFromFolder } = require("./getRandomUrlImage");
const { replaceRussianLetters } = require("./replaceRussianLetters");
const { russianName } = require('russian_name');

const accountSetup = async (page, accountId) => {
  const { setup } = await readAccount(accountId);

  console.log("Проверяю сетап для аккаунта:", accountId);

  if (setup) {
    console.log("Сетап для пользователя", accountId, "присутствует");

    return;
  }

  console.log("Сетап для пользователя", accountId, "отсутсвует");

  await page.waitForTimeout(15000);

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
      '.Checkbox-main:has-text("Show Message Previews"):has-text("Enabled")',
      {
        state: "attached",
        timeout: 5000,
      }
    );

    await notificationsChannels?.click();
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

  try {
    const contactJoin = await page?.waitForSelector(
      '.Checkbox-main:has-text("Contact joined Telegram"):has-text("Enabled")',
      {
        state: "attached",
        timeout: 5000,
      }
    );

    await contactJoin?.click();
  } catch {}

  try {
    const contactJoin = await page?.waitForSelector(
      '.Checkbox-main:has-text("Offline notifications"):has-text("Enabled")',
      {
        state: "attached",
        timeout: 5000,
      }
    );

    await contactJoin?.click();
  } catch {}

  try {
    const contactJoin = await page?.waitForSelector(
      '.Checkbox-main:has-text("Web notifications"):has-text("Enabled")',
      {
        state: "attached",
        timeout: 5000,
      }
    );

    await contactJoin?.click();
  } catch {}

  try {
    const notificationsWeb = await page?.waitForSelector(
      '.Checkbox-main:has-text("Web notifications"):has-text("Enabled")',
      {
        state: "attached",
        timeout: 5000,
      }
    );

    await notificationsWeb?.click();
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

  const firstName = await page?.waitForSelector(
    'input[aria-label="First name (required)"]',
    {
      state: "attached",
    }
  );

  const lastName = await page?.waitForSelector(
    'input[aria-label="Last name (optional)"]',
    {
      state: "attached",
    }
  );
  const bio = await page?.waitForSelector('textarea[aria-label="Bio"]', {
    state: "attached",
  });
  const userName = await page.waitForSelector('input[aria-label="Username"]', {
    state: "attached",
  });

  try {
    const image = getRandomImageFromFolder(
      "/Users/pikcelll/Documents/cold/telegram/images"
    );

    const uploadElement = await page.$("input[type=file]");
    await uploadElement.setInputFiles(image);

    await page.waitForLoadState();

    await page.waitForTimeout(10000);

    const buttonSave = await page.waitForSelector(
      'button[aria-label="Crop image"]',
      {
        state: "attached",
        timeout: 5000,
      }
    );

    await buttonSave?.click();

    await page.waitForTimeout(25000);
  } catch {}
  const nameRandom = getRandomName();
  const aiRandomName = `${replaceRussianLetters(nameRandom)}_${
    Math.floor(Math.random() * 9e5) + 1e5
  }`;
  await firstName?.fill(nameRandom, { delay: 100 });
  await lastName?.fill("", { delay: 100 });
  await bio?.fill("", { delay: 100 });
  await userName?.fill(`${aiRandomName}`, { delay: 100 });
  console.log(aiRandomName);
  try {
    const buttonSave = await page.waitForSelector('button[title="Save"]', {
      state: "attached",
      timeout: 5000,
    });

    await buttonSave?.click();

    await page.waitForTimeout(15000);

    await page.waitForFunction((button) => !button.disabled, buttonSave);

    await page.waitForTimeout(15000);
  } catch (e) {
    console.log(e);
  }

  const buttonElements = await page?.$$('button[title="Go back"]');

  await buttonElements[1].click();
  await buttonElements[0].click();

  console.log("Создал сетап для аккаунта:", accountId);

  await updateAccount(accountId, {
    setup: true,
    name: nameRandom,
    aiUsername: aiRandomName?.toLowerCase(),
  });
};

module.exports = { accountSetup };
