const { default: axios } = require("axios");

const {
  updateAccountRemainingTime,
  readAccount,
  incrementMessageCount,
} = require("../db/account");
const { readMessage, deleteMessage, updateMessage } = require("../db/message");
const { generateRandomTime } = require("../utils/getRandomTime");
const { returnToChatList } = require("../utils/returnToChatList");
const { searchByUsername } = require("../utils/searchByUsername");
const { sendMessage } = require("../utils/sendMessage");
const { getUserInfo } = require("./getUserInfo");

function filterUnicodeSymbols(str) {
  // Создаем регулярное выражение, которое будет искать все смайлы и символы Unicode
  const regex =
    /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/gu;

  // Возвращаем новую строку, из которой удалены все смайлы и символы Unicode
  return str.replace(regex, "");
}

async function makePostRequest(accountData, description) {
  const dialogue = [
    `Привет, я хочу начать диалог с пользователем, чтобы установить контакт и заинтересовать его. Пожалуйста, предложи мне хороший первый вопрос, связанный с его деятельностью, который поможет нам начать продуктивный разговор. Сформируй глубокий вопрос на основе его деятельности (исходя из описания), который будет для пользователя действительно интересен. Будь искренне заинтересованным в диалоге и живым. Имя пользователя: ${accountData} Описание пользователя: ${description}
    Пожалуйста, не задавай больше одного вопроса, ограничься не более 200 символами. Никнейм пользователя: ${filterUnicodeSymbols(
      accountData
    )} Описание пользователя: ${filterUnicodeSymbols(description)}`,
  ];

  while (true) {
    try {
      const response = await axios.post("http://localhost/answer/", {
        dialogue,
      });

      const { data } = response;

      const message = data.replace("\n", "");

      return message;
    } catch (error) {
      console.log(`Ошибка запроса. ${error.message}`);
    }
  }
}

const autoSender = async (page, accountId) => {
  let username, message;

  // Получаем данные аккаунта
  try {
    const { remainingTime } = await readAccount(accountId);
    const remainingDate = new Date(remainingTime);
    const currentDate = new Date();

    if (remainingTime) {
      if (remainingDate > currentDate) {
        console.log(
          `Время для отправки сообщения аккаунтом ${accountId} ещё не наступило`
        );
        return;
      }
    }
  } catch (e) {
    console.log(
      `ERROR: Не удалось получить данные аккаунта ${accountId}. Ошибка: ${e.message}`
    );
    return;
  }

  // Получаем рандомное сообщение для отправки
  try {
    const {
      username: randomUsername,
      accountData,
      description,
      ...props
    } = await readMessage();

    console.log(
      "Данные пользователя для отправки: ",
      randomUsername,
      accountData,
      description,
      props
    );

    const messageData = await makePostRequest(accountData, description);

    console.log(messageData);

    username = randomUsername;
    message = messageData;

    console.log("Найдено сообщение для отправки");
  } catch (e) {
    console.log(
      `ERROR: Не удалось получить сообщение для отправки. Ошибка: ${e.message}`
    );
    return;
  }

  // Поиск пользователя по имени
  try {
    await searchByUsername(page, username);
    console.log(`Пользователь ${username} успешно найден в поиске`);
  } catch (e) {
    await returnToChatList(page);

    console.log(
      `ERROR: Поиск пользователя ${username} не удался. Ошибка: ${e.message}`
    );

    await updateMessage(username, { failed: true });

    return;
  }

  // Отправка сообщения
  try {
    try {
      const [userName] = await getUserInfo(page);

      if (String(userName) !== String(username)) {
        throw new Error("Пользователь не найден");
      }
    } catch {
      console.log("Ошибка при получении информации о пользователе");

      await updateMessage(username, { failed: true });

      return;
    }

    await sendMessage(page, message);
    await updateMessage(username);
    await incrementMessageCount(accountId);
    await updateAccountRemainingTime(accountId, generateRandomTime());

    console.log(`Сообщение успешно отправлено пользователю ${username}`);
  } catch (e) {
    console.log("Добавляем статус failed для сообщения в базу");
    await updateMessage(username, { failed: true });

    console.log(
      `ERROR: Отправка сообщения пользователю ${username} не удалась. Ошибка: ${e.message}`
    );
  }
};

module.exports = { autoSender };
