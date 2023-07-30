const { default: axios } = require("axios");

const { sendMessage } = require("../utils/sendMessage");
const { getUserInfo } = require("./getUserInfo");
const { postDialogue, getDialogue } = require("../db/dialogues");
const { findByGroupId } = require("../db/groupId");

const defaultPrompt = `Ты младший менеджер по продажам компании GROW, задавай наводящие целевые вопросы клиенту, прояви у него интерес к интеграции искусственного интеллекта в его проект или бизнес, отвечай грамотно на любой вопрос пользователя как младший менеджер по продажам, будь инициативным и предлагай пользователю возможное решение по интеграции искусственного интеллекта, если есть контекст деятельности собеседника. В результате диалога назначь клиенту Zoom встречу на 15 минут, на которой менеджер GROW детальней расскажет про технологию интеграции искусственного интеллекта в бизнес собеседника и покажет имеющиеся кейсы. Твоя основная цель – записать собеседника на Zoom созвон. Общайся на "вы", без слова "Ответ", даже если сообщение клиента не относится к контексту компании GROW. Начини сообщение с главной мысли, веди диалог как живой собеседник, ты можешь поболтать с пользователем на любую тему, но ты всегда должен помнить о поставленной тебе цели. Следуй цели. Не говори про искусственный интеллект, если текущее сообщение не затрагивает контекст компании и ее услуг. Дай краткий и понятный ответ клиенту только на заданный им вопрос. Ты не являешься ботом, ты младший менеджер по продажам. В ходе диалога задавай наводящие вопросы и подводи пользователя к цели диалога. Помни о цели. Если спросят о том кто ты или попросят рассказать о себе, то самостоятельно кратко презентуй себя на своей должности и инфо о компании GROW. Сперва анализируй контекст, а затем предметно отвечай на сообщения клиента исходя из своих возможностей и возможностей компании GROW. Ты умеешь рассказывать о возможностях интеграции искусственного интеллекта в бизнес и назначать встречу в Zoom клиету с менежером. Zoom встречу можешь назначить только в рамках диалога, не выходя за пределы чата. Компания GROW, где ты работаешь, является компаний по разработке IT продуктов для бизнеса, а именно: создание веб сайтов, интеграция искусственного интеллекта в бизнес и т.д.`;

async function makePostRequest(result, name, userBio, continuingPrompt) {
  const dialogue = [
    `${continuingPrompt}
    Просто напиши слово "Хорошо", если понял свою роль. ничего больше.`,
    `Переписка с клиентом до этого момента: ${result.join("\n")};

    Имя клиента: ${name}
    Описание клиента: ${userBio}
    Максимальная длина ответа - 200 символов, подготовь краткий и конструктивный ответ к пользователю учитывая параметры, свою роль и контекст выше, не забывай - твоя роль менеджер. ты даешь ответ клиенту. ни за что не выходи из роли, заданной тебе в параметрах выше. диалог происходит в личных сообщениях. обзятально не используй ссылки!.`,
  ];

  while (true) {
    try {
      const response = await axios.post("http://95.163.229.224/answer/", {
        dialogue,
      });

      const { data } = response;

      let pattern =
        /((http|https|www):\/\/.)?([a-zA-Z0-9'\/\.\-])+\.[a-zA-Z]{2,5}([a-zA-Z0-9\/\&\;\:\.\,\?\\=\-\_\+\%\'\~]*)/g;
      const message = data.replace("\n", "");
      const hasTextLink = message.match(pattern);

      if (hasTextLink) {
        console.log(
          `\x1b[4mПотенциальное сообщение:\x1b[0m \x1b[36m${message}\x1b[0m`
        );
        throw new Error("В ответе содержится ссылка");
      }

      if (
        message.includes("[") ||
        message.includes("]") ||
        message.includes("@")
      ) {
        console.log(
          `\x1b[4mПотенциальное сообщение:\x1b[0m \x1b[36m${message}\x1b[0m`
        );
        throw new Error("В ответе содержатся подозрительные символы");
      }

      if (message.toLowerCase().includes("менеджер:")) {
        console.log(
          `\x1b[4mПотенциальное сообщение:\x1b[0m \x1b[36m${message}\x1b[0m`
        );
        throw new Error("В ответе содержится слово: 'менеджер'");
      }

      return message;
    } catch (error) {
      console.log(`Ошибка запроса. ${error.message}`);
    }
  }
}

async function getPrompt(groupId) {
  const dataGroupId = await findByGroupId(groupId);
  const { propmpts: { continuing } = {} } = dataGroupId ?? {};

  return continuing ?? defaultPrompt;
}

async function getDialogues(page) {
  try {
    await page.waitForSelector(".Message", { timeout: 1500 });
    const messages = await page.$$(".Message.message-list-item");

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
            `Менеджер: ${textContent.slice(0, -5).replace("edited", "")}`
          );
        } else {
          result.push(
            `Клиент: ${textContent.slice(0, -5).replace("edited", "")}`
          );
        }
      }
    }

    return result;
  } catch (e) {
    console.log(e.message);

    return [];
  }
}

async function autoResponseDialogue(context, href, accountId) {
  let isSender;
  let senderPage = await context.newPage();

  // Проверяем, существует ли пользователь
  try {
    while (!isSender) {
      try {
        await senderPage.goto(href);
        await senderPage.waitForLoadState();

        const userInfo = await getUserInfo(senderPage);
        const { userName, userTitle, phone, userBio } = userInfo;
        const dialogues = await getDialogues(senderPage);
        const dialogueInfo = await getDialogue(accountId, href);
        const { groupId = 12343207728 } = dialogueInfo ?? {};
        const prompt = await getPrompt(groupId);
        const message = await makePostRequest(
          dialogues,
          userTitle,
          userBio,
          prompt
        );
        await sendMessage(senderPage, message);

        console.log(
          "\x1b[44m\x1b[1mИнформация о пользователе и диалоге:\x1b[0m"
        );
        console.log(
          `\x1b[4mТекущий groupId для автоответного сообщения:\x1b[0m \x1b[31m${groupId}\x1b[0m`
        );
        console.log(
          `\x1b[4mИнформация, полученная о пользователе вручную:\x1b[0m \x1b[33m${JSON.stringify(
            userInfo
          )}\x1b[0m`
        );
        console.log(
          `\x1b[4mИнформация, полученная о пользователе автоматически:\x1b[0m \x1b[36m${
            dialogueInfo ? "найдена" : "не найдена"
          }\x1b[0m`
        );
        console.log(
          `\x1b[4mПромпт для генерации автоответного сообщения:\x1b[0m \x1b[32m${prompt}\x1b[0m`
        );
        console.log(
          `\x1b[4mДиалог с пользователем на текущий момент:\x1b[0m \x1b[35m${dialogues.join(
            "\n"
          )}\x1b[0m`
        );
        console.log(
          `\x1b[4mСгенерированное сообщение для автоответа пользователю:\x1b[0m \x1b[34m${message}\x1b[0m`
        );

        dialogues.push(`Менеджер: ${message}`);
        isSender = true;

        try {
          await senderPage.goto("about:blank");
          await postDialogue({
            groupId,
            accountId,
            href,
            actualUsername: userName,
            bio: userBio,
            title: userTitle,
            phone,
            messages: dialogues,
            viewed: false,
            dateUpdated: new Date(),
          });
        } catch (e) {
          console.error(
            "ERROR: Произошла ошибка при сохранении диалога с пользователем:",
            e.message
          );
        }
      } catch (e) {
        console.error(
          "ERROR: произошла ошибка при написании сообщения пользователю:",
          e.message
        );

        await senderPage.goto("about:blank");
      }
    }
  } catch (e) {
    console.error(
      `ERROR: глобальная ошибка в цикле при отправке сообщения. Ошибка: ${e.message}`
    );
    await senderPage.close();
    return;
  }

  await senderPage.close();
}

const autoResponse = async (page, context, accountId) => {
  try {
    console.log("Начинаю поиск неотвеченных сообщений");
    await page.waitForTimeout(5000);

    const elements = await page.$$(".ListItem-button");
    const links = [];

    for (const element of elements) {
      const isUnread = await element.$(".ChatBadge.unread:not(.muted)");

      if (isUnread) {
        const hrefValue = await element.getProperty("href");
        const href = hrefValue._preview;
        const title = await (
          await element.waitForSelector(".title")
        ).textContent();

        if (title === "Telegram" || title === "Spam Info Bot") {
          continue;
        } else {
          links.push(href);
        }
      }
    }

    console.log(`Найдено ${links.length} неотвеченных сообщений`);

    for (const element of links) {
      await autoResponseDialogue(context, element, accountId);
    }
  } catch (error) {
    console.error("Произошла ошибка:", error);
  }
};

module.exports = { autoResponse };
