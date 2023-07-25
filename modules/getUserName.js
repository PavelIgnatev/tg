const getUserName = async (page) => {
  await page.waitForTimeout(3000);

  const buttonElement = await page?.waitForSelector(
    'button[title="More actions"]',
    { state: "attached" }
  );

  await buttonElement?.click();

  const settings = await page?.waitForSelector(
    ".MenuItem.compact:has-text('Add to contacts')"
  );

  await settings?.click();

  const inputName = await page?.waitForSelector(
    'input[aria-label="First name (required)"]'
  );

  const inputValue = await inputName?.getProperty("value");
  const name = await inputValue?.jsonValue();

  const closeButton = await page?.waitForSelector(
    "button.Button.confirm-dialog-button"
  );

  await closeButton.click();

  return name.trim().length > 0 ? name : "пользователь";
};

module.exports = { getUserName };
