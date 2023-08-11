const { default: axios } = require("axios");

async function changeProxy() {
  let retryCount = 0;

  while (retryCount < 10) {
    try {
      // const result = await axios.get(
      //   "https://frigate-proxy.ru/ru/change_ip/82d68ac1341d35f48d503c735d9a6149/1014889"
      // );
      const result = await axios.get(
        "https://changeip.mobileproxy.space/?proxy_key=d030cc21e0c3f83e5d0146d3efd0a857&format=json"
      );
      //3|main     | { status: 'err', message: 'Already change IP, please wait' }
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

      retryCount++;
    }
  }
}

module.exports = { changeProxy };
