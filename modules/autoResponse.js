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
const { makeRequestComplete } = require("../utils/makeRequestComplete");
const { makeRequestJSONGPT } = require("../utils/makeRequestJSONGPT");

function filterText(text) {
  var filteredText = text.replace(/[.\[\]$@%!#^&*+\\|<>\/{}]/g, "");
  return filteredText;
}

function checkArrayForSubstring(arr, substring) {
  for (let i = 0; i < arr.length; i++) {
    if (substring.includes(arr[i])) {
      return true;
    }
  }

  return false;
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

async function getOffer(groupId, fullStr) {
  const dataGroupId = await findByGroupId(groupId);
  let language = dataGroupId?.language || "РУССКИЙ";
  const {
    offer: {
      aiRole = "младший менеджер по продажам компании AiSender",
      companyDescription = "AiSender занимается автоматизацией первой линии продаж с помощью искуственного интеллекта",
      goal = "Получить согласие на зум встречу с старшим менеджером, который расскажет про продукт, если согласие получено, то ты передашь контакт Telegram пользователя менеджеру и он напишет в течении 24 часов.",
      addedInformation = "",
    },
  } = dataGroupId && dataGroupId.offer ? dataGroupId : { offer: {} };

  if (/[а-яА-Я]/.test(fullStr)) {
    language = "РУССКИЙ";
  }

  return { aiRole, companyDescription, addedInformation, goal, language };
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
      if (countTry > 2) {
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
        const userNameFilter = filterText(userTitle);
        const botName = filterText(aiName);
        const fullString =
          (userName ?? "") +
          (userTitle ?? "") +
          (userBio ?? "") +
          dialogues.map((dialog) => dialog.content).join("");
        const offer = await getOffer(groupId, fullString);
        const hasPromo = dialogues.some((dialog) =>
          checkArrayForSubstring(
            [
              "pdf",
              "материа",
              "промо",
              "през",
              "сайт",
              "коммерческое",
              "ссылк",
              "кп ",
              "bot",
              "бот",
              "zoom",
              "зум",
              "встреч",
              "созвон",
              "звонок",
            ],
            (dialog.content ?? "").toLowerCase()
          )
        );

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
          const variantMessage = (
            await makeRequestComplete(
              `
          ИСТОРИЯ ДИАЛОГА:
          ${[...dialogues]
            .map(
              (dialog) =>
                `# ${dialog.role === "user" ? userNameFilter : botName}: ${
                  dialog.content
                }`
            )
            .join("\n")}
          ТВОЕ ИМЯ: ${botName}
          ТВОЯ РОЛЬ: ${offer && offer.aiRole ? offer.aiRole : ""}
          ОПИСАНИЕ КОМПАНИИ: ${
            offer && offer.companyDescription ? offer.companyDescription : ""
          } 
          ${
            hasPromo &&
            `ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ: ${
              offer && offer.addedInformation ? offer.addedInformation : ""
            }`
          }
          ЦЕЛЬ ДЛЯ ${botName}: ответить на сообщениe(я) пользователя ${userNameFilter}, проявить у него интерес к получению подробной информации. ${
                offer && offer.goal && checkFunction(dialogues)
                  ? "В случае, если пользователь проявил активный интерес к получению подробной информации - " +
                    offer.goal
                  : ""
              }
  
          Верни только одно ответное сообщение к пользователю ${userNameFilter}, в котором будет содержаться основаная часть-отсылка на последнее сообщение с наводящим вопросом для продолжения общения.
          # ${botName}:`,
              true
            )
          )
            .split(`${userNameFilter}:`)[0]
            .replace(new RegExp(`${userNameFilter}\\.`, "g"), userNameFilter)
            .replace(new RegExp(`${userNameFilter}!`, "g"), userNameFilter)
            .replace(new RegExp(`${botName}:`, "g"), "");

          const message =
            offer.language === "АНГЛИЙСКИЙ"
              ? await makeRequestGPT(
                  [
                    {
                      role: "system",
                      content:
                        "Please serve as a language translator for me. You will receive sentences in various languages which you must accurately translate into English. Your main focus should be to maintain the original context, meaning, and nuances of each sentence. After translating, present only the English version of the sentence to me. Refrain from including any additional information, explanations, or modifications. Your translation should strive for precision and fidelity to the source material.",
                    },
                    {
                      role: "user",
                      content: variantMessage,
                    },
                  ],
                  0.7,
                  true,
                  false
                )
              : variantMessage;
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
          const { is_lead: ai_is_lead, explanation: ai_explanation } =
            await makeRequestJSONGPT([
              {
                role: "system",

                content: `Generate a JSON object with two elements based on the interaction between a potential client referred to as '${userNameFilter}' and ${offer.aiRole} named ${botName}.' The first element, 'is_lead,' should be a boolean value reflecting whether '${userNameFilter}' appears to be a promising sales lead based on their engagement with the services outlined in '${offer.companyDescription}.' The second element, 'explanation,' should offer a well-reasoned explanation supporting the 'is_lead' value, incorporating specific quotes and key points from the dialogue that demonstrate the prospect's interest or disinterest.`,
              },
              {
                role: "user",
                content: `'''${[...dialogues]
                  .map(
                    (dialog) =>
                      `# ${
                        dialog.role === "user" ? userNameFilter : botName
                      }: ${dialog.content}`
                  )
                  .join("\n")}'''`,
              },
            ]);
          console.log(
            `\x1b[4mДиалог лид? :\x1b[0m \x1b[30m${ai_is_lead}\x1b[0m`
          );
          console.log(
            `\x1b[4mОбъяснение :\x1b[0m \x1b[30m${ai_explanation}\x1b[0m`
          );
          const data = {
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
            ai_is_lead,
            ai_explanation,
          };

          // if (ai_is_lead) {
          //   data["lead"] = true;
          // }
          await postDialogue(data);
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
