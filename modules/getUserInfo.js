const getUserInfo = async (page) => {
  await page.waitForTimeout(3000);

  try {
    const userInfo = await page.waitForSelector(".chat-info-wrapper", {
      timeout: 3000,
    });
    await userInfo.click();

    let phone = "",
      userName = "",
      userBio = "",
      userTitle = "";

    try {
      const phoneContent = await page.waitForSelector(
        '.multiline-item:has-text("Phone")',
        {
          timeout: 3000,
        }
      );
      phone = (await phoneContent?.textContent())?.replace("Phone", "");
    } catch {}

    try {
      const userNameContent = await page.waitForSelector(
        '.multiline-item:has-text("Username")',
        {
          timeout: 3000,
        }
      );
      userName = (await userNameContent?.textContent())?.replace(
        "Username",
        ""
      );
    } catch {}

    try {
      const userBioContent = await page.waitForSelector(
        '.multiline-item:has-text("Bio")',
        {
          timeout: 3000,
        }
      );
      userBio = (await userBioContent?.textContent())?.replace("Bio", "");
    } catch {}

    try {
      const userTitleContent = await page.waitForSelector(
        ".ProfileInfo .title",
        {
          timeout: 3000,
        }
      );
      userTitle = await userTitleContent?.textContent();
    } catch {}

    const closeButton = await page.waitForSelector(".Button.close-button", {
      timeout: 3000,
    });
    await closeButton.click();

    return { phone, userName, userBio, userTitle };
  } catch (e) {
    console.log(e.message);
    return { phone: null, userName: null, userBio: null, userTitle: null };
  }
};

module.exports = { getUserInfo };
