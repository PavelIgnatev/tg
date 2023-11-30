const { default: axios } = require("axios");

const { sendMessage } = require("../utils/sendMessage");
const { getUserInfo } = require("./getUserInfo");
const {
  postDialogue,
  getDialogue,
  getHrefByAccountId,
} = require("../db/dialogues");
const { findByGroupId } = require("../db/groupId");
const { readAccount } = require("../db/account");
const { makeRequestGPT } = require("../utils/makeRequestGPT");

function filterText(text) {
  var filteredText = text.replace(/[.\[\]$@%!#^&*+\\|<>\/{}]/g, "");
  return filteredText;
}

async function getOffer(groupId) {
  const dataGroupId = await findByGroupId(groupId);
  const {
    offer: {
      aiRole = "младший менеджер по продажам компании AiSender",
      companyDescription = "AiSender занимается автоматизацией первой линии продаж с помощью искуственного интеллекта",
      goal = "получить согласие на зум встречу с старшим менеджером, который расскажет про продукт, если согласие получено, то менеджер напишет в течении 24 часов.",
    },
  } = dataGroupId && dataGroupId.offer ? dataGroupId : { offer: {} };
  return { aiRole, companyDescription, goal };
}

async function getDialogues(page, aiName, userName) {
  try {
    await page.waitForSelector(".Message", { timeout: 1500 });
    const messages = await page.$$(".Message.message-list-item");

    let result = [];
    const resultForAi = [];

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
              .replace(" AM", "")
              .replace(" PM", "")
              .slice(0, -5)
              .replace("edited", "")}`
          );
          resultForAi.push({
            role: "assistant",
            content: textContent
              .replace(" AM", "")
              .replace(" PM", "")
              .slice(0, -5)
              .replace("edited", ""),
          });
        } else {
          result.push(
            `${filterText(userName ?? "Клиент")}: ${textContent
              .replace(" AM", "")
              .replace(" PM", "")
              .slice(0, -5)
              .replace("edited", "")}`
          );
          resultForAi.push({
            role: "user",
            content: textContent
              .replace(" AM", "")
              .replace(" PM", "")
              .slice(0, -5)
              .replace("edited", ""),
          });
        }
      }
    }
    let currentSum = 0;
    const resultArray = [];
    for (const str of [...resultForAi].reverse()) {
      if (currentSum + str.content.length <= 2000) {
        resultArray.push(str);
        currentSum += str.content.length;
      } else {
        break;
      }
    }

    return [result, resultArray.reverse()];
  } catch (e) {
    console.log(e.message);

    return [[], []];
  }
}

async function autoResponseDialogue(context, href, accountId) {
  let isSender;
  let senderPage = await context.newPage();
  let countTry = 0;

  // Проверяем, существует ли пользователь
  try {
    while (!isSender) {
      if (countTry > 6) {
        throw new Error(
          "Максимальное количество ретраев, пользователь опоссум"
        );
      }

      try {
        console.log(href);
        await senderPage.goto(href);
        await senderPage.waitForLoadState();

        const userInfo = await getUserInfo(senderPage);
        const { userName, userTitle, phone, userBio } = userInfo;

        if (!userTitle) {
          console.log(
            "Имя пользователя не определено, запрещаю отправлять managerMessage"
          );
          await postDialogue({
            accountId,
            href,
            managerMessage: null,
          });
          return;
        }
        const { name: aiName = "Менеджер" } = await readAccount(accountId);

        const [resultDialogues, dialogues] = await getDialogues(
          senderPage,
          aiName,
          userTitle
        );
        const dialogueInfo = await getDialogue(accountId, href);
        const {
          groupId = 12343207728,
          blocked,
          stopped,
          managerMessage,
        } = dialogueInfo ?? {};

        try {
          const goToBottom = await senderPage.waitForSelector(
            'button[title="Go to bottom"]',
            {
              state: "attached",
              timeout: 2500,
            }
          );

          await goToBottom.click({ force: true });
        } catch {}

        if (blocked) {
          isSender = true;
          console.log(
            "Отправка автоответных сообщений пользователю заблокирована"
          );
          return;
        }

        if (!stopped) {
          const offer = await getOffer(groupId);
          const message = await makeRequestGPT(
            [
              {
                role: "system",
                content: `Тебя зовут ${filterText(aiName)}.
        Твоя роль: ${offer && offer.aiRole ? offer.aiRole : ""}.
        Описание компании: ${
          offer && offer.companyDescription ? offer.companyDescription : ""
        } 
        Целевое действие:  ${offer && offer.goal ? offer.goal : ""} 
          
        Твоя задача: отвечать пользователю ${filterText(
          userTitle
        )} и вести к целевому действию по воронке:: 
        1) приветствие
        2) проявление интереса к услуге из описания продукта, но без целевого действия 
        3) выдвигаем оффер с ключевым наводящим вопросом по ключевому действию, учитывая также и контекст компании 
        4) обрабатываем возражение или отвечаем на вопросы 
        5) благодарим пользователя 
        
        Длина ответного сообщения должна быть не более 25 слов. Если ты уже рассказал часть информации из "Описания компании", то повторно рассказывать не надо. Не путай этапы и не беги вперед. Не используй ссылки. Отвечай так, будто ты реальный человек. Пиши корректно и по правилам русского языка. Не приветствуй. Не здоровайся. Не извиняйся.pm2  Обрабатывай возражения пользователя, пытайся проявить у него интерес к услуге. Если пользователь уже согласен - выдвинь оффер для пользователя из целевого действия и поблагодари его за согласие, не задавая лишних вопросов, а если пока еще не согласен, то в конце ответного сообщения плавно задавай наводящий вопрос относительно оффера и описания продукта чтобы проявить интерес. Не здавай открытый вопросы, тебе нужно задавать конкретные наводящие вопро`,
              },
              ...dialogues,
            ],
            1
          );
          await sendMessage(senderPage, message);
          resultDialogues.push(`${filterText(aiName)}: ${message}`);
          console.log(
            `\x1b[4mСгенерированное сообщение для автоответа пользователю:\x1b[0m \x1b[34m${message}\x1b[0m`
          );
        } else if (managerMessage && managerMessage.trim()) {
          await sendMessage(senderPage, managerMessage);
          resultDialogues.push(`${filterText(aiName)}: ${managerMessage}`);
          console.log(
            `\x1b[4mСообщение для автоответа пользователю было написано с помощью менеджера:\x1b[0m \x1b[34m${managerMessage}\x1b[0m`
          );
        } else {
          console.log(
            "Отправка автоответных сообщений пользователю остановлена, работает ИИ"
          );
        }

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
          `\x1b[4mДиалог с пользователем на текущий момент:\x1b[0m \x1b[35m${resultDialogues.join(
            "\n"
          )}\x1b[0m`
        );

        isSender = true;

        try {
          await senderPage.goto("about:blank");
          await postDialogue({
            groupId,
            accountId,
            href,
            varUsername: userName?.toLowerCase(),
            bio: userBio,
            title: userTitle,
            phone,
            messages: resultDialogues,
            viewed: false,
            dateUpdated: new Date(),
            managerMessage: null,
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
        countTry += 1;

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
    const hrefs = await getHrefByAccountId(accountId);
    const elements = await page.$$(".ListItem-button");
    let links = new Set(hrefs);

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
          links.add(href);
        }
      }
    }
    links = [...links];
    console.log(`Найдено ${links.length} неотвеченных сообщений`);

    for (const element of links) {
      await autoResponseDialogue(context, element, accountId);
    }
  } catch (error) {
    console.error("Произошла ошибка:", error);
  }
};

module.exports = { autoResponse };
