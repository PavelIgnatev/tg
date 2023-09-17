const { default: axios } = require("axios");

async function changeProxy() {
  while (true) {
    try {
      const result = await axios.get(
        "https://changeip.mobileproxy.space/?proxy_key=d030cc21e0c3f83e5d0146d3efd0a857&format=json"
      );
      console.log(result.data);
      if (result.data.status === "err" || result.data.status === "ERR") {
        throw new Error("Ошибка");
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
