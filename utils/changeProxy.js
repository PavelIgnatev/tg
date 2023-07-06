const { default: axios } = require("axios");

async function changeProxy() {
  let retryCount = 0;

  while (retryCount < 10) {
    try {
      const result = await axios.get(
        "https://frigate-proxy.ru/ru/change_ip/82d68ac1341d35f48d503c735d9a6149/1014889"
      );

      if (result.data.includes("Слишком частая смена")) {
        console.log(
          "Слишком частая смена proxy. Повторный запрос... Ждем 10 секунд..."
        );
        retryCount++;
        await new Promise((resolve) => setTimeout(resolve, 10000));
      } else {
        console.log(result.data);
        await new Promise((resolve) => setTimeout(resolve, 10000));
        break;
      }
    } catch {
      console.log(
        "Ошибка при смене прокси. Повторный запрос... Ждем 10 секунд..."
      );
      retryCount++;
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  }
}

module.exports = { changeProxy };
