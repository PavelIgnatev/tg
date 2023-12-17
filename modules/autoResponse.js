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

function checkFunction(d) {
  const normalizeArr = [];
  let isFindUser = false;

  for (const l of d) {
    if (l.role === "user") {
      isFindUser = true;
    }

    if (!isFindUser) {
      continue;
    }

    normalizeArr.push(l);
  }
  return Boolean(normalizeArr.filter((e) => e.role === "assistant").length);
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
      if (currentSum + str.content.length <= 4000) {
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

        if (managerMessage && managerMessage.trim()) {
          await sendMessage(senderPage, managerMessage);
          resultDialogues.push(`${filterText(aiName)}: ${managerMessage}`);
          console.log(
            `\x1b[4mСообщение для автоответа пользователю было написано с помощью менеджера:\x1b[0m \x1b[34m${managerMessage}\x1b[0m`
          );
        } else if (!stopped) {
          const offer = await getOffer(groupId);
          const userName = filterText(userTitle);
          const botName = filterText(aiName);
          const message = await makeRequestGPT(
            [
              {
                role: "system",
                content: `
                Вы выполняете роль функции топ-продавца ( роль 'assistant', тебя зовут'${botName}), которая возвращает лучшее ответное сообщение c ключевым вопросом на основании переданного контекста РОЛИ В КОМПАНИИ, ОПИСАНИИ КОМПАНИИ, ЦЕЛИ ДИАЛОГА для дальнейшего продолжения диалога и подведения '${userName}' к ЦЕЛИ ДИАЛОГА на основании ИСТОРИИ СООБЩЕНИЙ (между 'assistant' - это вы и 'user' - это соответственно '${userName}', которому генерируется ответ). Максимальная длина ответного сообщения - 30 слов. Вы - профессиональный продавец, но не говорите об этом '${userName}'. Вы умеете хорошо продавать, по-умному обрабатывать возражения, проявлять интерес у '${userName}' к услуге и подводить его к целевому действию. '${userName}', которому вы пишете ответ, ничего о вас не знает и не встречался с вами раньше, надо продумать как работать с этим для достижения лучшего качества. В ответе, который ты сгенерируешь, обязательно должны быть ответы на все вопросы '${userName}', только после ответов на вопросы должна идти основаная часть + наводяищий вопрос. Если '${userName}' запрашивает информацию, которой нет в ОПИСАНИИ КОМПАНИИ, пропустите вопрос. '${userName}' не должен ничего знать о том, что вы топ-продавец, также он не должен знать, что у вас есть ЦЕЛЬ ДИАЛОГА, держите это в секрете и не говорите ему, представьтесь только как РОЛЬ КОМПАНИИ. Если '${userName}' проявляет интерес, выдвиньте предложение из ЦЕЛИ ДИАЛОГА и поблагодарите его за согласие, не задавая лишних вопросов. Не приветствуйте '${userName}'. Действуйте только в рамках имеющегося контекста, вы не можете придумывать новые услуги, вы должны предлагать только то, что указано в ОПИСАНИИ КОМПАНИИ или ЦЕЛИ ДИАЛОГА. Не извиняйтесь перед '${userName}' и не просите у него прощения.  Не возвращайте скобки в ответе: []. Если '${userName}' спросит откуда у тебя его контакт - ответь 'если честно - уже забыл'.
                Ниже предоставлена ДОПОЛНИТЕЛЬНАЯ информация:
                ТВОЕ ИМЯ: ${botName}
                РОЛЬ ВНУТРИ КОМПАНИИ: ${
                  offer && offer.aiRole ? offer.aiRole : ""
                }
                ОПИСАНИЕ КОМПАНИИ: ${
                  offer && offer.companyDescription
                    ? offer.companyDescription
                    : ""
                } 
                ЦЕЛЬ ДИАЛОГА:  ${
                  offer && offer.goal && checkFunction(dialogues)
                    ? offer.goal
                    : `ОБЯЗАТЕЛЬНО Ответить на вопрос '${userName}' (если он есть), ОБЯЗАТЕЛЬНО рассказать чем занимается ОПИСАНИЕ КОМПАНИИ и спросить было бы ему интересно узнать больше о ОПИСАНИЕ КОМПАНИИ`
                }
                Максимальная длина ответного сообщения - 30 слов.`,
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
