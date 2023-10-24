const { default: axios } = require("axios");

async function changeProxy(url) {
  while (true) {
    try {
      const result = await axios.get(`${url}&format=json`);
      console.log(result.data);
      if (result.data.status === "err" || result.data.status === "ERR") {
        throw new Error("Ошибка при смене прокси ", url);
      }
      await new Promise((resolve) => setTimeout(resolve, 5000));
      break;
    } catch (e) {
      console.log(e.message);
      console.log(
        "Ошибка при смене прокси. Повторный запрос... Ждем 5 секунд..."
      );
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

module.exports = { changeProxy };
