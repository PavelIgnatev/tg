const { default: axios } = require("axios");

const { sendMessage } = require("../utils/sendMessage");
const { getUserInfo } = require("./getUserInfo");
const { postDialogue, getDialogue } = require("../db/dialogues");
const { findByGroupId } = require("../db/groupId");

async function makePostRequest(
  result,
  myName,
  userName,
  userBio,
  continuingPrompt = `Ты младший менеджер по продажам компании GROW, задавай наводящие целевые вопросы клиенту, прояви у него интерес к интеграции искусственного интеллекта в его проект или бизнес, отвечай грамотно на любой вопрос пользователя как младший менеджер по продажам, будь инициативным и предлагай пользователю возможное решение по интеграции искусственного интеллекта, если есть контекст деятельности собеседника. В результате диалога назначь клиенту Zoom встречу на 15 минут, на которой менеджер GROW детальней расскажет про технологию интеграции искусственного интеллекта в бизнес собеседника и покажет имеющиеся кейсы. Твоя основная цель – записать собеседника на Zoom созвон. Общайся на "вы", без слова "Ответ", даже если сообщение клиента не относится к контексту компании GROW. Начини сообщение с главной мысли, веди диалог как живой собеседник, ты можешь поболтать с пользователем на любую тему, но ты всегда должен помнить о поставленной тебе цели. Следуй цели. Не говори про искусственный интеллект, если текущее сообщение не затрагивает контекст компании и ее услуг. Дай краткий и понятный ответ клиенту только на заданный им вопрос. Ты не являешься ботом, ты младший менеджер по продажам. В ходе диалога задавай наводящие вопросы и подводи пользователя к цели диалога. Помни о цели. Если спросят о том кто ты или попросят рассказать о себе, то самостоятельно кратко презентуй себя на своей должности и инфо о компании GROW. Сперва анализируй контекст, а затем предметно отвечай на сообщения клиента исходя из своих возможностей и возможностей компании GROW. Ты умеешь рассказывать о возможностях интеграции искусственного интеллекта в бизнес и назначать встречу в Zoom клиету с менежером. Zoom встречу можешь назначить только в рамках диалога, не выходя за пределы чата. Компания GROW, где ты работаешь, является компаний по разработке IT продуктов для бизнеса, а именно: создание веб сайтов, интеграция искусственного интеллекта в бизнес и т.д. `
) {
  const dialogue = [
    `${continuingPrompt}
    Просто напиши слово "Хорошо", если понял свою роль. ничего больше.`,
    `Твое имя: ${myName}
    Имя клиента: ${userName}
    Описание пользоватея: ${userBio}
    Переписка с клиентом до этого момента: ${result.join("\n")};
    Максимальная длина ответа - 200 символов, подготовь краткий и конструктивный ответ к пользователю учитывая параметры и контекст выше.`,
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
      console.log(`Ошибка запроса. ${error.message}`);
    }
  }
}

const autoResponse = async (page, aiName, aiUsername) => {
  try {
    console.log("Начинаю поиск неотвеченных сообщений");
    await page.waitForTimeout(5000);
    const elements = await page.$$(
      ".ListItem:not(:has-text('Spam Info Bot')) .ChatBadge.unread:not(.muted)"
    );
    console.log(`Найдено ${elements.length} неотвеченных сообщений`);

    for (const element of elements) {
      await element.click();
      try {
        await element.click();
      } catch {}

      const userInfo = await getUserInfo(page);
      const { userName, userTitle, phone, userBio } = userInfo;

      console.log("Данные пользователя для автоответа: ", userInfo);

      console.log(userTitle)
      if (
        userTitle.trim() === "Telegram" ||
        userTitle.trim() === "Spam Info Bot"
      ) {
        console.log("Этот диалог с Telegram, пропускаем");
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
              `${aiName}: ${textContent.slice(0, -5).replace("edited", "")}`
            );
          } else {
            result.push(
              `${userTitle}: ${textContent.slice(0, -5).replace("edited", "")}`
            );
          }
        }
      }

      const dialogueInfo = await getDialogue(userName, aiUsername);
      const { groupId = 12343207728 } = dialogueInfo ?? {};

      console.log("Текущий groupId для автоответного сообщения: ", groupId);
      const { propmpts: { continuing } = {} } = await findByGroupId(groupId);

      if (continuing) {
        console.log("Текущий groupId имеет заданный продолжающий промпт.");
      }

      const message = await makePostRequest(
        result,
        aiName,
        userTitle,
        userBio,
        continuing
      );

      console.log("Полученное сообщение для автоответа: ", message);

      try {
        console.log("Начинаю отправку автоответного сообщения");
        await sendMessage(page, message);
        console.log("Автоответное сообщение отправлено");
      } catch (e) {
        console.log(e.message);
      }

      console.log("Начал сохранение истории диалога");
      result.push(`${aiName}: ${message}`);
      await postDialogue({
        groupId,
        username: userName,
        aiUsername,
        bio: userBio,
        title: userTitle,
        phone,
        messages: result,
        viewed: false,
        dateUpdated: new Date(),
      });
      console.log("Завершил сохранение истории диалога");
    }
  } catch (error) {
    console.error("Произошла ошибка:", error);
  }
};

module.exports = { autoResponse };
