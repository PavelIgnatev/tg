const { default: axios } = require("axios");

const { readAccount } = require("../db/account");
const { sendMessage } = require("../utils/sendMessage");
const { getUserInfo } = require("./getUserInfo");
const { checkSpam } = require("../modules/checkSpam");
const { makeRequestGPT } = require("../utils/makeRequestGPT");

const autoSender = async (accountId, context) => {
  // Проверяем, можем ли мы писать
  try {
    const { remainingTime } = await readAccount(accountId);
    const remainingDate = new Date(remainingTime);
    const currentDate = new Date();

    if (remainingTime) {
      if (remainingDate > currentDate) {
        console.log(
          "Время для отправки сообщения аккаунтом",
          accountId,
          "ещё не наступило"
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
    const isSpam = await checkSpam(context);

    if (isSpam) {
      axios.post("http://localhost/recipient", {
        status: "spam",
        username: userName,
        accountId,
        groupId,
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

  try {
    while (!userInfo || !userInfo.userName) {
      try {
        const {
          data: { username, groupId: resGroupId, resPrompts },
        } = await axios("http://localhost/recipient", {
          params: { accountId },
        });
        groupId = resGroupId;
        prompts = resPrompts;

        await senderPage.goto(
          `https://web.telegram.org/a/#?tgaddr=tg%3A%2F%2Fresolve%3Fdomain%3D${username}`
        );
        userInfo = await getUserInfo(senderPage);

        if (!userInfo || !userInfo.userName) {
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
    const { userTitle, userBio, userName, phone } = userInfo;

    const { first } = prompts ?? {};

    if (first) {
      console.log("Текущий groupId имеет заданный первый промпт.");
    }
    const defaultPrompt = `Привет, я хочу начать диалог с пользователем, чтобы установить контакт и заинтересовать его. Пожалуйста, предложи мне хороший первый вопрос, связанный с его деятельностью, который поможет нам начать продуктивный разговор. Сформируй глубокий вопрос на основе его деятельности (исходя из описания), который будет для пользователя действительно интересен. Будь искренне заинтересованным в диалоге и живым.`;
    const prompt = `${first || defaultPrompt}
    Пожалуйста, не задавай больше одного вопроса, ограничься не более 200 символами. Пиши по орфографическим правилам русского языка. Использование ссылок, спецсимволов и смайликов строко запрещено!!!, не используй никаких ссылок при ображении (нельзя www, .com, .ru и другие домены и ссылки)
    Имя пользователя: ${userTitle}
    Описание пользователя: ${userBio}`;
    const message = await makeRequestGPT([prompt]);
    console.log("Текущее сообщение для пользователя: ", message);

    // отправляем сообщение
    try {
      await sendMessage(senderPage, message);
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
        messages: [`Менеджер: ${message}`],
        viewed: false,
        dateCreated: new Date(),
      },
    });

    console.log(
      `Информация о отправке сообщения пользователю ${userName} сохранена`
    );
  } catch (e) {
    console.error(
      `ERROR: Отправка сообщения пользователю ${userInfo.userName} не удалась. Ошибка: ${e.message}`
    );
  }
  await senderPage.close();
};

module.exports = { autoSender };
