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

  try {
    while (!userInfo || !userInfo.userTitle) {
      try {
        const {
          data: { username, groupId: resGroupId, resPrompts },
        } = await axios("http://localhost/recipient", {
          params: { accountId },
        });
        // const username = "AndrewPodolsky";
        // const resGroupId = 12343207728;
        // const resPrompts = {};
        groupId = resGroupId;
        prompts = resPrompts;
        userName = username;

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
      ? `Задача сформировать ОДИН простой вопрос на основе деятельности пользователя, который будет для него действительно интересен. Будь искренне заинтересованным. Не обращайся к пользователю по имени или фамилии, не здоровайся и не приветствуй его. Обязательно формируй вопрос уважительно, используя обращение 'Вы' к пользователю. Придумывать деятельность пользователя запрещено. В конце вопроса заранее поблагодари его за ответ. Ответ должен быть не длиннее 150 символов и содержать только ОДИН глубокий вопрос, дополнительных вопросов быть не должно. \n !!!Описание пользователя: ${userBio}!!!`
      : "Задача сформировать ОДИН простой вопрос для собеседника, деятельность которого неизвестна и информации о которой нет. Соответственно вопрос должен быть общим. Будь искренне заинтересованным. Вопрос должен быть адекватным, без иззотерики и чего-либо подобного. Вопрос должен быть про профессиональную деятельность. На него должно быть приятно отвечать. Обязательно формируй вопрос уважительно, используя обращение 'Вы' к пользователю. В конце вопроса заранее поблагодари его за уделенное время на ответ мне. Ответ должен быть длиною примерно 100 символов и содержать только ОДИН глубокий вопрос, дополнительных вопросов быть не должно. Не здоровайся и не приветствуй его.";

    const propmtOne = `Данные о пользователе: ${userTitle} \n
    Твоя задача вернуть сообщение со словом "здравствуйте" и именем пользователя, если его получилось получить из информации о пользователе, а если не получилось - то просто слово "здравствуйте!"
    Только слово "здравствуйте" + имя (если удалось получить его из предоставленной выше информации), без фамилии и отчества, не возвращай никаких дополнительных скобок типа [], никаких вопросов и предложений, ты просто выполняешь роль функции, возвращающей текст. Запрещено возвращать в ответе  [Имя пользователя] и что-либо подобное. Само имя переведи на русский язык, если это возможно`;
    const message = await makeRequestGPT(
      [{ role: "system", content: prompt }],
      userBio ? 0.5 : 0.35
    );
    const messageOne = await makeRequestGPT(
      [{ role: "system", content: propmtOne }],
      0.5,
      false
    );

    // отправляем сообщение
    try {
      await sendMessage(senderPage, messageOne);
      await sendMessage(senderPage, message);

      console.log("Текущее 'Первое' сообщение для пользователя: ", messageOne);
      console.log("Текущее 'Второе' сообщение для пользователя: ", message);

      await senderPage.waitForTimeout(10000000);
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
        messages: [`Менеджер: ${messageOne}`, `Менеджер: ${message}`],
        viewed: false,
        dateCreated: new Date(),
      },
    });

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
