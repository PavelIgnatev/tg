const { default: axios } = require("axios");

const { sendMessage } = require("../utils/sendMessage");
const { getUserInfo } = require("./getUserInfo");
const { postDialogue, getDialogue } = require("../db/dialogues");
const { findByGroupId } = require("../db/groupId");
const { readAccount } = require("../db/account");

function filterText(text) {
  var filteredText = text.replace(/[.\[\]$@%!#^&*+\\|<>\/{}]/g, "");
  return filteredText;
}

const defaultPrompt = `Ты младший менеджер по продажам компании GROW, ты продаешь интеграции ИИ`;

async function makePostRequest(result, personName, botName, offerDescription) {
  console.log(`Имя пользователя: ${personName}`);
  console.log(`Имя бота: ${botName}`);
  console.log(`
  Описание оффера: ${offerDescription.slice(
    -1510
  )}. Диалог с пользователем на текущий момент: ${result
    .join("\n")
    .slice(
      -1300
    )}. Ты - сотрудник компании, роль которого прописана в оффере, имя которого ${botName}. Твоя задача Придумать одно ответное сообщение без приветствия на основании контекста диалога на текущий момент для пользователя ${personName} если имя написано на иностранном языке то переведи на русский язык. Отвечай кратко, сдержанно и в человеческой манере, не более 250 символов на ответ. Не повторяйся в вопросах и предложениях и веди пользователя к цели, задавая наводящие вопросы если он еще не достиг цели оффера. Если пользователь проявил интересн то сформируй и выдай ему цельный оффер. Если пользователь просит информацию, которой нет в оффере, например, ссылку на сайт, то скажи, что такой информации у меня нет. Если тебя спросят о том кто ты или попросят рассказать о себе, то самостоятельно кратко презентуй себя на основе информации из оффера. `)
  const dialogue = [
    `
    Описание оффера: ${offerDescription.slice(
      -1510
    )}. Диалог с пользователем на текущий момент: ${result
      .join("\n")
      .slice(
        -1300
      )}. Ты - сотрудник компании, роль которого прописана в оффере, имя которого ${botName}. Твоя задача Придумать одно ответное сообщение без приветствия на основании контекста диалога на текущий момент для пользователя ${personName} если имя написано на иностранном языке то переведи на русский язык. Отвечай кратко, сдержанно и в человеческой манере, не более 250 символов на ответ. Не повторяйся в вопросах и предложениях и веди пользователя к цели, задавая наводящие вопросы если он еще не достиг цели оффера. Если пользователь проявил интересн то сформируй и выдай ему цельный оффер. Если пользователь просит информацию, которой нет в оффере, например, ссылку на сайт, то скажи, что такой информации у меня нет. Если тебя спросят о том кто ты или попросят рассказать о себе, то самостоятельно кратко презентуй себя на основе информации из оффера. `,
  ];

  while (true) {
    try {
      const response = await axios.post("http://194.135.25.158/answer/", {
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

      if (message.includes("[") || message.includes("]")) {
        console.log(
          `\x1b[4mПотенциальное сообщение:\x1b[0m \x1b[36m${message}\x1b[0m`
        );
        throw new Error("В ответе содержатся подозрительные символы");
      }

      if (
        message.toLowerCase().includes("sorry") ||
        message.toLowerCase().includes("that") ||
        message.toLowerCase().includes("can") ||
        message.toLowerCase().includes("help") ||
        message.toLowerCase().includes("hmm")
      ) {
        console.log(
          `\x1b[4mПотенциальное сообщение:\x1b[0m \x1b[36m${message}\x1b[0m`
        );
        throw new Error("В ответе содержится слово 'Sorry'");
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
  const { propmpts: { offerDescription } = {} } = dataGroupId ?? {};

  return offerDescription ?? defaultPrompt;
}

async function getDialogues(page, aiName, userName) {
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
            `${filterText(aiName)}: ${textContent
              .slice(0, -5)
              .replace("edited", "")}`
          );
        } else {
          result.push(
            `${filterText(userName ?? "Клиент")}: ${textContent
              .slice(0, -5)
              .replace("edited", "")}`
          );
        }
      }
    }
    let currentSum = 0;
    const resultArray = [];

    for (const str of result.reverse()) {
      if (currentSum + str.length <= 1300) {
        resultArray.push(str);
        currentSum += str.length;
      } else {
        break;
      }
    }

    return [result.reverse(), resultArray.reverse()]
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
        console.log(href);
        await senderPage.goto(href);
        await senderPage.waitForLoadState();

        const userInfo = await getUserInfo(senderPage);
        const { userName, userTitle, phone, userBio } = userInfo;

        if (!userTitle) {
          console.log("Имя пользователя не определено");
          return;
        }
        const { name: aiName = "Менеджер" } = await readAccount(accountId);
        const [resultDialogues, dialogues] = await getDialogues(senderPage, aiName, userTitle);
        const dialogueInfo = await getDialogue(accountId, href);
        const { groupId = 12343207728 } = dialogueInfo ?? {};
        const prompt = await getPrompt(groupId);
        const message = await makePostRequest(
          dialogues,
          filterText(userTitle),
          filterText(aiName),
          prompt
        );

        try {
          const goToBottom = await senderPage.waitForSelector(
            'button[title="Go to bottom"]',
            {
              state: "attached",
              timeout: 2500,
            }
          );

          await goToBottom.click();
        } catch {}
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
          `\x1b[4mДиалог с пользователем на текущий момент:\x1b[0m \x1b[35m${resultDialogues.join(
            "\n"
          )}\x1b[0m`
        );
        console.log(
          `\x1b[4mСгенерированное сообщение для автоответа пользователю:\x1b[0m \x1b[34m${message}\x1b[0m`
        );

        resultDialogues.push(`${filterText(aiName)}: ${message}`);
        isSender = true;

        try {
          await senderPage.goto("about:blank");
          await postDialogue({
            groupId,
            accountId,
            href,
            // var username
            username: userName?.toLowerCase(),
            bio: userBio,
            title: userTitle,
            phone,
            messages: resultDialogues,
            viewed: false,
            dateUpdated: new Date(),
          });
        } catch (e) {
          await senderPage.goto("about:blank");

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

        if (
          title === "Telegram" ||
          title === "Spam Info Bot" ||
          title === "Deleted Account" ||
          href.includes("-")
        ) {
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
