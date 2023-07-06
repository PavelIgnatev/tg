const { default: axios } = require("axios");

async function changeProxy() {
  try {
    const result = await axios.get(
      "https://frigate-proxy.ru/ru/change_ip/82d68ac1341d35f48d503c735d9a6149/1014889"
    );
    if (result.data.includes("Слишком частая смена")) {
      console.log("Слишком частая смена proxy. Повторный запрос...");
      await changeProxy();
    } else {
      await new Promise((res) => setTimeout(res, 10000));
      console.log(result.data);
    }
  } catch {
    console.log("Ошибка при смене прокси. Повторный запрос...");
    await changeProxy();
  }
}

module.exports = { changeProxy };
