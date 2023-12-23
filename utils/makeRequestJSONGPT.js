const { default: axios } = require("axios");

async function makeRequestJSONGPT(dialogue) {
  while (true) {
    try {
      const response = await axios.post("http://81.31.245.212/chat/", {
        dialogue,
        temperature: 0.5,
      });

      const { data } = response;

      if (
        typeof data !== "object" ||
        data["is_lead"] === undefined ||
        data["explanation"] === undefined
      ) {
        throw new Error("Недостающие поля");
      }

      return data;
    } catch (error) {
      console.log(`Ошибка запроса. ${error.message}`);
    }
  }
}

module.exports = { makeRequestJSONGPT };

