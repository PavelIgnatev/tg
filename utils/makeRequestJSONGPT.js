const { default: axios } = require("axios");

async function makeRequestJSONGPT(dialogue) {
  while (true) {
    try {
      const response = await axios.post("http://81.31.245.212/chat/", {
        dialogue,
        temperature: 0.1,
      });

      const { data } = response;

      if (
        typeof data !== "object" ||
        data["is_lead"] === undefined ||
        data["explanation"] === undefined
      ) {
        console.log("Недостающие поля", data);
      }

      return {
        is_lead: data && data["is_lead"],
        explanation: data && data["explanation"],
      };
    } catch (error) {
      console.log(`Ошибка запроса. ${error.message}`);
    }
  }
}

module.exports = { makeRequestJSONGPT };
