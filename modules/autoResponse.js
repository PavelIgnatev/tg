const { default: axios } = require("axios");

const { getMyName } = require("./getMyName");
const { getUserName } = require("./getUserName");
const { sendMessage } = require("../utils/sendMessage");
const { getUserInfo } = require("./getUserInfo");
const { postResponse } = require("../db/responses");

async function makePostRequest(result, myName, userName) {
  const dialogue = [
    `Ты ${myName} - младший менеджер по продажам компании GROW, задавай наводящие целевые вопросы клиенту, прояви у него интерес к интеграции искусственного интеллекта в его проект или бизнес, отвечай грамотно на любой вопрос пользователя как младший менеджер по продажам, будь инициативным и предлагай пользователю возможное решение по интеграции ИИ, если есть контекст деятельности собеседника. В результате диалога назначь клиенту Zoom встречу на 15 минут, на которой продукт менеджер GROW детальней расскажет про технологию интеграции ИИ в бизнес собеседника и покажет имеющиеся кейсы. Твоя основная цель – записать собеседника на Zoom созвон. Общайся на "вы", без слова "Ответ", даже если сообщение клиента не относится к контексту компании GROW. Начини сообщение с главной мысли, веди диалог как живой собеседник, ты можешь поболтать с пользователем на любую тему, но ты всегда должен помнить о поставленной тебе цели. Следуй цели. Не говори про ИИ, если текущее сообщение не затрагивает контекст компании и ее услуг. Дай краткий и понятный ответ клиенту только на заданный им вопрос. Ты не являешься ботом, ты младший менеджер по продажам. В ходе диалога задавай наводящие вопросы и подводи пользователя к цели диалога. Помни о цели. Если спросят о том кто ты или попросят рассказать о себе, то самостоятельно кратко презентуй себя на своей должности и инфо о компании GROW. Сперва анализируй контекст, а затем предметно отвечай на сообщения клиента исходя из своих возможностей и возможностей компании GROW. Ты умеешь рассказывать о возможностях интеграции ИИ в бизнес и назначать встречу в Zoom клиету с продукт менежером. Zoom встречу можешь назначить только в рамках диалога, не выходя за пределы чата. Компания GROW, где ты работаешь, является компаний по разработке IT продуктов для бизнеса, а именно: создание веб сайтов, интеграция ИИ в бизнес и т.д.
Просто напиши слово "Хорошо", если понял свою роль. ничего больше.`,
    `Имя клиента: ${userName}. Переписка с клиентом до этого момента: ${result.join(
      "\n"
    )}; Максимальная длина ответа: 200 символов`,
  ];

  while (true) {
    try {
      const response = await axios.post("http://localhost/answer/", {
        dialogue,
      });

      const { data } = response;

      const message = data.replace("\n", "");

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

  await page.waitForTimeout(5000);
  try {
    console.log("Начинаю поиск сообщений");

    const elements = await page.$$(".ChatBadge.unread:not(.muted)");

    console.log(elements.length);

    for (const element of elements) {
      await element.click();
      await element.click();

      console.log("Начинаю получение имени пользователя");
      const userName = await getUserName(page);
      const [userNameTG, phone] = await getUserInfo(page);

      console.log(`Текущее имя у Пользователя: ${userName}`);

      if (userName.includes("Telegram")) {
        continue;
      }

      await page.waitForSelector(".Message", { timeout: 1500 });

      await page.setViewportSize({ width: 1500, height: 9999 });
      await page.waitForTimeout(2000);
      const messages = await page.$$(".Message.message-list-item");
      await page.setViewportSize({ width: 1500, height: 700 });

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
        viewed: false,
      });
      console.log("Завершил сохранение истории диалога");
    }
  } catch (error) {
    console.error("Произошла ошибка:", error);
  }
};

module.exports = { autoResponse };
