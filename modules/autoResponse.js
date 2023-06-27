const { default: axios } = require("axios");

const { getMyName } = require("./getMyName");
const { getUserName } = require("./getUserName");
const { sendMessage } = require("../utils/sendMessage");
const { getUserInfo } = require("./getUserInfo");
const { postResponse } = require("../db/responses");

async function makePostRequest(result, myName, userName) {
  const dialogue = `
  ${result.join("\n")}. \n
  Продолжи диалог под именем ${myName}, ответь на вопросы пользоваетеля ${userName} , а после предложи провести zoom-встречу (но только в случае, если пользователем ${myName} было отправлено не менее 2 сообщений), на которой ${myName} расскажет как можно использовать ИИ для разития продукта ${userName}, также будь человечнее, максимальная длина результата 300 символов, формат результата, который я ожидаю: "${myName}: (после двоеточия будет сообщение)" `;
  console.log(dialogue);

  while (true) {
    try {
      const response = await axios.get(
        `http://localhost/answer/?dialogue=${dialogue}`
      );

      const { data } = response;

      const message = data.replace("\n", "");

      if (!message.includes(`${myName}:`) || message.includes(`${userName}:`)) {
        throw new Error();
      }

      return message
        .replace(`${myName}:`, "")
        .replace(`${userName}:`, "")
        .replace(`, ${myName}`, "")
        .replace(`, я ${userName}`, "");
    } catch (error) {
      console.log(`Ошибка запроса.`);
    }
  }
}

const autoResponse = async (page) => {
  console.log("Начинаю получение моего имени");
  const myName = await getMyName(page);
  console.log(`Текущее имя у аккаунта: ${myName}`);
  try {
    console.log("Начинаю поиск сообщений");

    const elements = await page.$$(".ChatBadge.unread:not(.muted)");

    for (const element of elements) {
      await element.click();

      console.log("Начинаю получение имени пользователя");
      const userName = await getUserName(page);
      const [userNameTG, phone] = await getUserInfo(page);

      console.log(`Текущее имя у Пользователя: ${userName}`);

      if (userName.includes("Telegram")) {
        console.log("skip tg");
        continue;
      }

      await page.waitForSelector(".Message", { timeout: 1500 });

      await page.setViewportSize({ width: 1300, height: 9999 });
      await page.waitForTimeout(2000);
      const messages = await page.$$(".Message.message-list-item");
      await page.setViewportSize({ width: 1300, height: 700 });

      let result = [];

      for (const element of messages) {
        const isOwnMessage = await element
          .getAttribute("class")
          .then((classes) => classes.includes(" own "));
        const textElement = await element.$(".text-content");
        const textContent = await textElement?.textContent();

        if (textContent) {
          if (isOwnMessage) {
            result.push(
              `${myName}: ${textContent.slice(0, -5).replace("edited", "")}`
            );
          } else {
            result.push(
              `${userName}: ${textContent.slice(0, -5).replace("edited", "")}`
            );
          }
        }
      }

      const message = await makePostRequest(result, myName, userName);
      console.log(message);
      result.push(`${myName}: ${message}`);

      console.log("Начинаю отправку автоответного сообщения");
      await sendMessage(page, message);
      console.log("Автоответное сообщение отправлено");

      console.log("Начал сохранение истории диалога");
      await postResponse({
        username: phone ? phone : userNameTG ? userNameTG : "Not defined",
        messages: result,
      });
      console.log("Завершил сохранение истории диалога");
    }
  } catch (error) {
    console.error("Произошла ошибка:", error);
  }
};

module.exports = { autoResponse };
