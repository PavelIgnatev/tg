const { default: axios } = require("axios");

function filterText(text) {
  const filteredText = text.replace(/[.\[\]$@%!#^&*+\\|<>\/{}]/g, "");
  const regex =
    /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/gu;

  return filteredText.replace(regex, "");
}

async function makeRequestGPT(dialogue) {
  while (true) {
    try {
      const response = await axios.post("http://194.135.25.158/answer/", {
        dialogue: dialogue.map(filterText),
      });

      const { data } = response;

      let pattern =
        /((http|https|www):\/\/.)?([a-zA-Z0-9'\/\.\-])+\.[a-zA-Z]{2,5}([a-zA-Z0-9\/\&\;\:\.\,\?\\=\-\_\+\%\'\~]*)/g;
      const message = data.replace("\n", "");
      const hasTextLink = message.match(pattern);

      if (hasTextLink) {
        console.log(
          `\x1b[4mПотенциальное сообщение:\x1b[0m \x1b[36m${message}\x1b[0m`
        );
        throw new Error("В ответе содержится ссылка");
      }

      if (message.includes("[") || message.includes("]")) {
        console.log(
          `\x1b[4mПотенциальное сообщение:\x1b[0m \x1b[36m${message}\x1b[0m`
        );
        throw new Error("В ответе содержатся подозрительные символы");
      }
      const variantMessage = message.toLowerCase();
      if (
        variantMessage.includes("sorry") ||
        variantMessage.includes("that") ||
        variantMessage.includes("can") ||
        variantMessage.includes("hmm")
      ) {
        console.log(
          `\x1b[4mПотенциальное сообщение:\x1b[0m \x1b[36m${message}\x1b[0m`
        );
        throw new Error("В ответе содержится слово 'Sorry'");
      }

      return message;
    } catch (error) {
      console.log(`Ошибка запроса. ${error.message}`);
    }
  }
}

module.exports = { makeRequestGPT };
