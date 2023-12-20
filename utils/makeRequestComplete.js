function capitalizeFirstLetter(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

async function makeRequestComplete(prompt) {
  while (true) {
    try {
      const response = await axios.post("http://81.31.245.212/complete/", {
        prompt ,
      });
      const { data } = response;

      if (!data.trim()) {
        throw new Error("Пустое сообщение");
      }

      let pattern =
        /((?:(http|https|Http|Https|rtsp|Rtsp):\/\/(?:(?:[a-zA-Z0-9\$\-\_\.\+\!\*\'\(\)\,\;\?\&\=]|(?:\%[a-fA-F0-9]{2})){1,64}(?:\:(?:[a-zA-Z0-9\$\-\_\.\+\!\*\'\(\)\,\;\?\&\=]|(?:\%[a-fA-F0-9]{2})){1,25})?\@)?)?((?:(?:[a-zA-Z0-9][a-zA-Z0-9\-]{0,64}\.)+(?:(?:aero|arpa|asia|a[cdefgilmnoqrstuwxz])|(?:biz|b[abdefghijmnorstvwyz])|(?:cat|com|coop|c[acdfghiklmnoruvxyz])|d[ejkmoz]|(?:edu|e[cegrstu])|f[ijkmor]|(?:gov|g[abdefghilmnpqrstuwy])|h[kmnrtu]|(?:info|int|i[delmnoqrst])|(?:jobs|j[emop])|k[eghimnrwyz]|l[abcikrstuvy]|(?:mil|mobi|museum|m[acdghklmnopqrstuvwxyz])|(?:name|net|n[acefgilopruz])|(?:org|om)|(?:pro|p[aefghklmnrstwy])|qa|r[eouw]|s[abcdeghijklmnortuvyz]|(?:tel|travel|t[cdfghjklmnoprtvwz])|u[agkmsyz]|v[aceginu]|w[fs]|y[etu]|z[amw]))|(?:(?:25[0-5]|2[0-4][0-9]|[0-1][0-9]{2}|[1-9][0-9]|[1-9])\.(?:25[0-5]|2[0-4][0-9]|[0-1][0-9]{2}|[1-9][0-9]|[1-9]|0)\.(?:25[0-5]|2[0-4][0-9]|[0-1][0-9]{2}|[1-9][0-9]|[1-9]|0)\.(?:25[0-5]|2[0-4][0-9]|[0-1][0-9]{2}|[1-9][0-9]|[0-9])))(?:\:\d{1,5})?)(\/(?:(?:[a-zA-Z0-9\;\/\?\:\@\&\=\#\~\-\.\+\!\*\'\(\)\,\_])|(?:\%[a-fA-F0-9]{2}))*)?(?:\b|$)/gi;
      const message = data
        .replace("\n", "")
        .replace("\n", "")
        .replace("\n", "")
        .replace("\n", "")
        .replace("\n", "")
        .replace("\n", "")
        .replace("\n", "")
        .replace(pattern, "")
        .trim();

      if (
        message.includes("[") ||
        message.includes("]") ||
        message.includes("(") ||
        message.includes(")")
      ) {
        console.log(
          `\x1b[4mПотенциальное сообщение:\x1b[0m \x1b[36m${message}\x1b[0m`
        );
        throw new Error("В ответе содержатся подозрительные символы");
      }

      return capitalizeFirstLetter(
        message
          .replace("Привет, ", "")
          .replace("Привет! ", "")
          .replace("Привет!", "")
          .replace("Здравствуйте, ", "")
          .replace("Здравствуйте! ", "")
          .replace("Здравствуйте!", "")
          .replace("Приветствую, ", "")
          .replace("Приветствую! ", "")
          .replace("Приветствую!", "")
          .replace("Здравствуй, ", "")
          .replace("Здравствуй! ", "")
          .replace("Здравствуй!", "")
          .replace("Доброе утро, ", "")
          .replace("Доброе утро! ", "")
          .replace("Доброе утро!", "")
          .replace("Добрый вечер, ", "")
          .replace("Добрый вечер! ", "")
          .replace("Добрый вечер!", "")
          .replace("Добрый день, ", "")
          .replace("Добрый день! ", "")
          .replace("Добрый день!", "")
          .replace("Привет", "")
          .replace("Здравствуйте", "")
          .replace("Приветствую", "")
          .replace("Здравствуй", "")
          .replace("Доброе утро", "")
          .replace("Добрый вечер", "")
          .replace("Добрый день", "")
          .replace("привет", "")
          .replace("здравствуйте", "")
          .replace("приветствую", "")
          .replace("здравствуй", "")
          .replace("доброе утро", "")
          .replace("добрый вечер", "")
          .replace("добрый день", "")
      );
    } catch (error) {
      console.log(`Ошибка запроса. ${error.message}`);
    }
  }
}
module.exports = { makeRequestComplete };
