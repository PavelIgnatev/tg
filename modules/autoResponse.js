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
  const language = dataGroupId?.language || "РУССКИЙ";
  const {
    offer: {
      aiRole = "младший менеджер по продажам компании AiSender",
      companyDescription = "AiSender занимается автоматизацией первой линии продаж с помощью искуственного интеллекта",
      goal = "получить согласие на зум встречу с старшим менеджером, который расскажет про продукт, если согласие получено, то менеджер напишет в течении 24 часов.",
    },
  } = dataGroupId && dataGroupId.offer ? dataGroupId : { offer: {} };
  return { aiRole, companyDescription, goal, language };
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
        const offer = await getOffer(groupId);

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
          const variantMessage = await makeRequestComplete(`
          ТВОЕ ИМЯ: ${botName}
          ТВОЯ РОЛЬ: ${offer && offer.aiRole ? offer.aiRole : ""}
          ОПИСАНИЕ КОМПАНИИ: ${
            offer && offer.companyDescription ? offer.companyDescription : ""
          } 
          ЦЕЛЬ ДЛЯ ${botName}: ответить на сообщениe(я) пользователя ${userNameFilter}, проявить у него интерес к предложению компании. ${
            offer && offer.goal && checkFunction(dialogues)
              ? "В случае, если пользователь проявил активный интерес к предложению - твоей задачей является " +
                offer.goal
              : ""
          }
  
          ${[...dialogues]
            .map(
              (dialog) =>
                `# ${dialog.role === "user" ? userNameFilter : botName}: ${
                  dialog.content
                }`
            )
            .join("\n")}
          # ${botName}:`);

          const message =
            offer.language === "АНГЛИЙСКИЙ"
              ? await makeRequestGPT(
                  [
                    {
                      role: "system",
                      content:
                        "You will be given a sentence, your task is to translate this sentence into ENGLISH. It is forbidden to change the context. In the answer return only the sentence translated into ENGLISH!",
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
                content: `As an expert in creating JSON objects for lead analysis, carefully examine the provided snippet of conversation between ${userNameFilter}, who holds the position of ${offer.aiRole} and ${botName}. Company description: ${offer.companyDescription}. Your assignment is to construct a JSON object that accurately evaluates the interaction for lead generation potential. Ensure that your JSON object includes the following two attributes:

              1. 'is_lead': This attribute must be of boolean type, either true or false. Set it to true if the analyzed dialogue indicates that {botName} has shown interest in the company's services, or if there's an engagement that could imply potential interest. Conversely, if the dialogue lacks any indication of interest or engagement, set this attribute to false.
              
              2. 'explanation': This attribute should contain a nuanced and detailed analysis explaining your decision regarding the 'is_lead' status of ${userNameFilter}. Highlight specific elements of the conversation, such as questions asked, enthusiasm expressed, or any other criteria that signal ${userNameFilter}'s level of interest in the company's services.
              
              Your JSON object should be both precise and informative, serving as a reliable tool for the assessment of potential leads. Ensure that your analysis is error-free and provides clear justifications for your conclusions.`,
              },
              {
                role: "user",
                content: `'''${[...resultDialogues]
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
            // ai_is_lead,
            // ai_explanation,
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
