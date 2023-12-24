const { default: axios } = require("axios");

const { sendMessage } = require("../utils/sendMessage");
const { getUserInfo } = require("./getUserInfo");
const { checkSpam } = require("../modules/checkSpam");
const { makeRequestGPT } = require("../utils/makeRequestGPT");

const defaultSecondMessageWithBioPrompt =
  "Примите роль составителя вопросов. Вам нужно создать вопрос, который будет кратким (до 100 символов, но не менее 30 символов), содержательным и связанным с описанием деятельности пользователя. Описание пользователя: ${userBio}";

const defaultSecondMessageWithoutBioPrompt =
  "Примите роль составителя вопросов. Вам нужно создать вопрос, который будет кратким (до 100 символов, но не менее 30 символов), содержательным для пользователя, деятельность которого неизвестна и информации о которой нет.";

const addContext = (companyDescription, userDescription, message) => {
  const companyRegExp = new RegExp("\\${companyDescription}", "g");
  const userRegExp = new RegExp("\\${userDescription}", "g");

  return message
    .replace(companyRegExp, companyDescription)
    .replace(userRegExp, userDescription);
};

const autoSender = async (accountId, context, account) => {
  // Проверяем, можем ли мы писать
  try {
    const { remainingTime } = account;
    const remainingDate = new Date(remainingTime);
    const currentDate = new Date();

    if (remainingTime) {
      if (remainingDate > currentDate) {
        console.log(
          `Время для отправки сообщения аккаунтом ${accountId} ещё не наступило`
        );
        console.log(`Текущая дата: ${currentDate}`);
        console.log(`Дата, до которой не отправляем: ${remainingDate}`);
        const difference = Math.abs(new Date(remainingTime) - currentDate);
        const hours = Math.floor(difference / 3600000);
        const minutes = Math.floor((difference % 3600000) / 60000);
        const seconds = Math.floor((difference % 60000) / 1000);
        const formattedDifference = `${hours}:${minutes}:${seconds}`;
        console.log(`Разница: ${formattedDifference}`);
        return;
      }
    }
  } catch (e) {
    console.error(
      `ERROR: Не удалось получить данные аккаунта ${accountId}. Ошибка: ${e.message}`
    );
    return;
  }

  try {
    const isSpam = await checkSpam(context, accountId);

    if (isSpam === "banned") {
      return isSpam;
    }

    if (isSpam) {
      axios.post("http://localhost/recipient", {
        status: "spam",
        accountId,
      });
      return;
    }
  } catch (e) {
    console.error(
      `ERROR: Не удалось получить аккаунт в спаме или нет. Ошибка: ${e.message}`
    );
    return;
  }

  let userInfo;
  let senderPage = await context.newPage();
  let groupId;
  let retry;
  let userName;
  let language;
  let secondMessagePromptWithBio;
  let secondMessagePromptWithoutBio;
  let companyDescription;

  try {
    while (!userInfo || !userInfo.userTitle) {
      try {
        const {
          data: {
            username,
            groupId: resGroupId,
            language: resLanguage,
            offer,
            secondMessagePrompt: resSecondMessagePrompt,
            secondMessagePromptWithBio: resSecondMessagePromptWithBio,
            secondMessagePromptWithoutBio: resSecondMessagePromptWithoutBio,
          },
        } = await axios("http://localhost/recipient", {
          params: { accountId },
        });

        groupId = resGroupId;
        userName = username;
        language = resLanguage || "РУССКИЙ";
        secondMessagePromptWithBio =
          resSecondMessagePromptWithBio ||
          resSecondMessagePrompt ||
          defaultSecondMessageWithBioPrompt;
        secondMessagePromptWithoutBio =
          resSecondMessagePromptWithoutBio ||
          resSecondMessagePrompt ||
          defaultSecondMessageWithoutBioPrompt;
        companyDescription =
          offer && offer.companyDescription ? offer.companyDescription : "";

        await senderPage.goto(
          `https://web.telegram.org/a/#?tgaddr=tg%3A%2F%2Fresolve%3F${
            username.includes("+") ? "phone" : "domain"
          }%3D${username}`,
          { timeout: 60000 }
        );

        userInfo = await getUserInfo(senderPage);

        if (!userInfo || !userInfo.userTitle) {
          console.log(
            `Пользователь ${username} не найден, добавляю статус failed`
          );
          axios.post("http://localhost/recipient", {
            status: "error",
            username,
            accountId,
            groupId,
          });
          await senderPage.goto("about:blank");
        }
      } catch (e) {
        retry += 1;
        console.log(e.message);

        await senderPage.goto("about:blank");

        if (retry > 4) {
          throw new Error("Максимально количество ретраев");
        }
      }
    }
  } catch (e) {
    console.error(
      `ERROR: глобальная ошибка в цикле при отправке сообщения. Ошибка: ${e.message}`
    );
    await senderPage.close();
    return;
  }

  // Отправка сообщения
  try {
    console.log("Данные пользователя для отправки: ", userInfo);
    const { userTitle, userBio, phone } = userInfo;
    const userData = userTitle.replace(/[^a-zA-Zа-яА-Я\s]/g, "");

    const translatePrompt =
      "Please serve as a language translator for me. You will receive sentences in various languages which you must accurately translate into English. Your main focus should be to maintain the original context, meaning, and nuances of each sentence. After translating, present only the English version of the sentence to me. Refrain from including any additional information, explanations, or modifications. Your translation should strive for precision and fidelity to the source material.";
    const firstMessagePrompt = `Данные о пользователе: ${userData}. Твоя задача – проанализировать предоставленную строку данных о пользователе и извлечь из неё имя. Используя это имя, сформируй корректное приветствие, начинающееся с фразы "Здравствуйте". Если имя извлечь не удаётся, твоё сообщение должно состоять из одного слова "Здравствуйте!" без дополнительных символов, вопросов или предложений. При успешном извлечении имени, не используй плейсхолдеры, а вставь имя напрямую в приветствие, как часть естественной речи. Если имя пользователя на иностранном языке, переведи его на русский язык и включи в приветствие. Например, если имя пользователя – "John", твой ответ должен быть "Здравствуйте, Джон!".`;
    const partSecondMessagePrompt =
      'Формулируйте вопрос так, чтобы он вызывал у пользователя заинтересованность и уважение, используя обращение на "Вы". Избегайте приветствий и упоминания имён или фамилий. В завершение включите выражение благодарности за предоставленный ответ. Убедитесь, что в вопросе присутствует только один вопросительный знак, и он не содержит дополнительных уточнений и пояснений.';
    const secondMessagePrompt = addContext(
      companyDescription,
      userBio,
      `${
        userBio ? secondMessagePromptWithBio : secondMessagePromptWithoutBio
      }. ${partSecondMessagePrompt}`
    );

    const firstMessage = await makeRequestGPT(
      [{ role: "system", content: firstMessagePrompt }],
      0.5,
      false
    );
    const secondMessage = await makeRequestGPT(
      [{ role: "system", content: secondMessagePrompt }],
      0.5
    );

    const firstMessageResult =
      language === "АНГЛИЙСКИЙ"
        ? await makeRequestGPT(
            [
              {
                role: "system",
                content: translatePrompt,
              },
              {
                role: "user",
                content: firstMessage,
              },
            ],
            0.7,
            true,
            false
          )
        : firstMessage;
    const secondMessageResult =
      language === "АНГЛИЙСКИЙ"
        ? await makeRequestGPT(
            [
              {
                role: "system",
                content: translatePrompt,
              },
              {
                role: "user",
                content: secondMessage,
              },
            ],
            0.7,
            false,
            false
          )
        : secondMessage;

    // отправляем сообщение
    try {
      await sendMessage(senderPage, firstMessageResult);
      await sendMessage(senderPage, secondMessageResult);

      console.log(
        "Текущее 'Первое' сообщение для пользователя: ",
        firstMessageResult
      );
      console.log(
        "Текущее 'Второе' сообщение для пользователя: ",
        secondMessageResult
      );

      const href = await senderPage.url();
      axios.post("http://localhost/recipient", {
        status: "done",
        username: userName,
        accountId,
        groupId,
        dialogue: {
          groupId,
          accountId,
          href,
          username: userName,
          bio: userBio,
          title: userTitle,
          phone,
          messages: [
            `Менеджер: ${firstMessageResult}`,
            `Менеджер: ${secondMessageResult}`,
          ],
          viewed: false,
          dateCreated: new Date(),
        },
      });
    } catch (e) {
      console.log("Начинаю добавлять статус failed для сообщения в базу");

      axios.post("http://localhost/recipient", {
        status: "error",
        username: userName,
        accountId,
        groupId,
      });
      console.log("Добавил статус failed для сообщения в базу");
      console.log(e.message);
    }

    // добавляем отправленное сообщение в общий список диалогов

    console.log(
      `Информация о отправке сообщения пользователю ${userName} сохранена`
    );
  } catch (e) {
    console.error(
      `ERROR: Отправка сообщения пользователю ${userName} не удалась. Ошибка: ${e.message}`
    );
  }
  await senderPage.close();
};

module.exports = { autoSender };
