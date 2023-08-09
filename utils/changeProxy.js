const { default: axios } = require("axios");

async function changeProxy() {
  let retryCount = 0;

  while (retryCount < 10) {
    try {
      // const result = await axios.get(
      //   "https://frigate-proxy.ru/ru/change_ip/82d68ac1341d35f48d503c735d9a6149/1014889"
      // );
      const result = await axios.get(
        "https://changeip.mobileproxy.space/?proxy_key=4cb5992cf633de2b5b7e5d8d2c37d516&format=json"
      );
      console.log(result.data);
      await new Promise((resolve) => setTimeout(resolve, 5000));
      break;
    } catch (e) {
      console.log(e.message);
      console.log(
        "Ошибка при смене прокси. Повторный запрос... Ждем 10 секунд..."
      );
      retryCount++;
    }
  }
}

module.exports = { changeProxy };
