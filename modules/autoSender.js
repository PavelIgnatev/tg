const { default: axios } = require("axios");

const {
  updateAccountRemainingTime,
  readAccount,
  incrementMessageCount,
} = require("../db/account");
const {
  updateMessage,
  getRandomMessage,
  getFailedUsernames,
} = require("../db/message");
const { generateRandomTime } = require("../utils/getRandomTime");
const { sendMessage } = require("../utils/sendMessage");
const { getUserInfo } = require("./getUserInfo");
const { getGroupId, createOrUpdateCurrentCount } = require("../db/groupId");
const {
  postDialogue,
  getUsernamesByGroupId,
  getDialogueUsername,
} = require("../db/dialogues");
const { checkSpam } = require("../modules/checkSpam");

function filterText(text) {
  var filteredText = text.replace(/[.\[\]$@%!#^&*+\\|<>\/{}]/g, "");
  return filteredText;
}

function filterUnicodeSymbols(str) {
  const regex =
    /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/gu;

  return str.replace(regex, "");
}

const processAccounts = [];

async function makePostRequest(
  accountData,
  description,
  prompt = `Привет, я хочу начать диалог с пользователем, чтобы установить контакт и заинтересовать его. Пожалуйста, предложи мне хороший первый вопрос, связанный с его деятельностью, который поможет нам начать продуктивный разговор. Сформируй глубокий вопрос на основе его деятельности (исходя из описания), который будет для пользователя действительно интересен. Будь искренне заинтересованным в диалоге и живым.`
) {
  const dialogue = [
    `${prompt}
    Пожалуйста, не задавай больше одного вопроса, ограничься не более 200 символами. Пиши по орфографическим правилам русского языка. Использование ссылок, спецсимволов и смайликов строко запрещено!!!
    Имя пользователя: ${filterUnicodeSymbols(accountData)}
    Описание пользователя: ${filterUnicodeSymbols(description)}`,
  ];

  while (true) {
    try {
      const response = await axios.post("http://95.163.229.126/answer/", {
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

      return message;
    } catch (error) {
      console.log(`Ошибка запроса. ${error.message}`);
    }
  }
}

async function readUserName(groupId, accountId, database) {
  console.log("Начинаю получать username для написания из базы group id");
  // тут пофиксить надо короче будет чтобы мы авафывфывыф
  const usersSender = await getUsernamesByGroupId(groupId);
  const failedUsers = await getFailedUsernames();

  // здесь можно по факту еще проверять есть ли диалог или нет
  // но на больших объемах врятли будут проблемы
  // проблемы не будет только в случае, если чел не менял юзернейм
  // но если поменял - это фиаск, мы напишем ему типо, привяжем к базе,
  // но он будет обработан первым попавшимся групп айди (на сколько понимаю)
  // вообще не крит, но по-хорошему обработать кейс потом, когда диалог уже есть
  // чтобы не было  ебки
  for (let i = 0; i < database.length; i++) {

    const vaUsername = database[i].toLowerCase();
    if (
      !usersSender.includes(vaUsername) &&
      !failedUsers.includes(vaUsername) &&
      !processAccounts.includes(vaUsername)
    ) {
      // проверяем, имеется ли у нашего ai пользователя уже диалог с данным человеком
      // независимо от group id
      const dialoque = await getDialogueUsername(accountId, vaUsername);
      if (!dialoque) {
        console.log("Получил username для написания из базы group id");
        processAccounts.push(vaUsername);
        return vaUsername;
      }
    }
  }

  console.log("Начинаю получать username для написания из общей базы");
  while (true) {
    try {
      const varUsername = await getRandomMessage();

      if (
        !varUsername ||
        !varUsername.username ||
        usersSender.includes(varUsername.username.toLowerCase()) ||
        failedUsers.includes(varUsername.username.toLowerCase()) ||
        processAccounts.includes(varUsername.username.toLowerCase())
      ) {
        continue;
      }

      const dialoque = await getDialogueUsername(
        accountId,
        varUsername.username.toLowerCase()
      );

      if (!dialoque) {
        console.log("Получил username для написания из общей базы");
        processAccounts.push(varUsername.username.toLowerCase());
        return varUsername.username.toLowerCase();
      }
    } catch (e) {
      console.log(e.message);
    }
  }
}

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

  const { groupId, propmpts, database } = await getGroupId();
  console.log("Текущий groupId для присваивания к сообщению: ", groupId);
  let retry;

  // Проверяем, существует ли пользователь
  try {
    // реально сделать ретрай бы
    while (!userInfo) {
      try {
        let username = await readUserName(groupId, accountId, database);

        await senderPage.goto(
          `https://web.telegram.org/a/#?tgaddr=tg%3A%2F%2Fresolve%3Fdomain%3D${username}`
        );

        userInfo = await getUserInfo(senderPage);

        if (!userInfo || !userInfo.userName) {
          console.log(
            `Пользователь ${username} не найден, добавляю статус failed`
          );
          await updateMessage(username, {
            failed: true,
            dateUpdated: new Date(),
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

    const { first } = propmpts ?? {};

    if (first) {
      console.log("Текущий groupId имеет заданный первый промпт.");
    }

    const message = await makePostRequest(
      filterText(userTitle),
      filterText(userBio),
      first
    );
    console.log("Текущее сообщение для пользователя: ", message);

    // отправляем сообщение
    try {
      await sendMessage(senderPage, message);
    } catch (e) {
      console.log("Начинаю добавлять статус failed для сообщения в базу");
      await updateMessage(userInfo.userName, {
        failed: true,
        dateUpdated: new Date(),
      });
      console.log("Добавил статус failed для сообщения в базу");
      console.log(e.message);
    }

    // добавляем отправленное сообщение в общий список диалогов
    const href = await senderPage.url();
    await postDialogue({
      groupId,
      accountId,
      href,
      username: userName/.toLowerCase(),
      bio: userBio,
      title: userTitle,
      phone,
      messages: [`Менеджер: ${message}`],
      viewed: false,
      dateCreated: new Date(),
    });

    const index = processAccounts.indexOf(userName.toLowerCase());
    if (index !== -1) {
      processAccounts.splice(index, 1);
    }

    await updateMessage(userName, {
      dateUpdated: new Date(),
    });

    // увеличиваем счетчик отправленных сообщений с groupId на 1
    await createOrUpdateCurrentCount(groupId);

    // увеличиваем счетчик отправленных сообщений с аккаунт на 1
    await incrementMessageCount(accountId);

    // увеличиваем лимит времени, через который можно будет снова писать на аккаунте
    await updateAccountRemainingTime(accountId, generateRandomTime());

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
