const { default: axios } = require("axios");

const { sendMessage } = require("../utils/sendMessage");
const { getUserInfo } = require("./getUserInfo");
const { checkSpam } = require("../modules/checkSpam");
const { makeRequestGPT } = require("../utils/makeRequestGPT");

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
  let prompts;
  let retry;
  let userName;
  let language;

  try {
    while (!userInfo || !userInfo.userTitle) {
      try {
        const {
          data: {
            username,
            groupId: resGroupId,
            resPrompts,
            language: resLanguage,
          },
        } = await axios("http://localhost/recipient", {
          params: { accountId },
        });
        // const username = "AndrewPodolsky";
        // const resGroupId = 12343207728;
        // const resPrompts = {};
        groupId = resGroupId;
        prompts = resPrompts;
        userName = username;
        language = resLanguage || "РУССКИЙ";

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

    const { first } = prompts ?? {};

    if (first) {
      console.log("Текущий groupId имеет заданный первый промпт.");
    }

    const prompt = userBio
      ? `Примите роль составителя вопросов. Вам нужно создать вопрос, который будет кратким (до 100 символов, но не менее 30 символов), содержательным и связанным с описанием деятельности пользователя: ${userBio}. Формулируйте вопрос так, чтобы он вызывал у пользователя заинтересованность и уважение, используя обращение на 'Вы'. Избегайте приветствий и упоминания имён или фамилий. В завершение включите выражение благодарности за предоставленный ответ. Убедитесь, что в вопросе присутствует только один вопросительный знак, и он не содержит дополнительных уточнений и пояснений.`
      : "Примите роль составителя вопросов. Вам нужно создать вопрос, который будет кратким (до 100 символов, но не менее 30 символов), содержательным для пользователя деятельность которого неизвестна и информации о которой нет. Формулируйте вопрос так, чтобы он вызывал у пользователя заинтересованность и уважение, используя обращение на 'Вы'. Избегайте приветствий и упоминания имён или фамилий. В завершение включите выражение благодарности за предоставленный ответ. Убедитесь, что в вопросе присутствует только один вопросительный знак, и он не содержит дополнительных уточнений и пояснений.";

    const propmtOne = `Данные о пользователе: ${userTitle.replace(
      /[^a-zA-Zа-яА-Я\s]/g,
      ""
    )}. Твоя задача – проанализировать предоставленную строку данных о пользователе и извлечь из неё имя. Используя это имя, сформируй корректное приветствие, начинающееся с фразы "Здравствуйте". Если имя извлечь не удаётся, твоё сообщение должно состоять из одного слова "Здравствуйте!" без дополнительных символов, вопросов или предложений. При успешном извлечении имени, не используй плейсхолдеры, а вставь имя напрямую в приветствие, как часть естественной речи. Если имя пользователя на иностранном языке, переведи его на русский язык с помощью ${language} и включи в приветствие. Например, если имя пользователя – "John", твой ответ должен быть "Здравствуйте, Джон!".`;

    const translatePrompt =
      "Please serve as a language translator for me. You will receive sentences in various languages which you must accurately translate into English. Your main focus should be to maintain the original context, meaning, and nuances of each sentence. After translating, present only the English version of the sentence to me. Refrain from including any additional information, explanations, or modifications. Your translation should strive for precision and fidelity to the source material.";
    const varMessageOne = await makeRequestGPT(
      [{ role: "system", content: propmtOne }],
      0.5,
      false
    );
    const varMessage = await makeRequestGPT(
      [{ role: "system", content: prompt }],
      userBio ? 0.5 : 0.35
    );

    const message =
      language === "АНГЛИЙСКИЙ"
        ? await makeRequestGPT(
            [
              {
                role: "system",
                content: translatePrompt,
              },
              {
                role: "user",
                content: varMessage,
              },
            ],
            0.7,
            true,
            false
          )
        : varMessage;
    const messageOne =
      language === "АНГЛИЙСКИЙ"
        ? await makeRequestGPT(
            [
              {
                role: "system",
                content: translatePrompt,
              },
              {
                role: "user",
                content: varMessageOne,
              },
            ],
            0.7,
            false,
            false
          )
        : varMessageOne;

    // отправляем сообщение
    try {
      await sendMessage(senderPage, messageOne);
      await sendMessage(senderPage, message);

      console.log("Текущее 'Первое' сообщение для пользователя: ", messageOne);
      console.log("Текущее 'Второе' сообщение для пользователя: ", message);

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
          messages: [`Менеджер: ${messageOne}`, `Менеджер: ${message}`],
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
