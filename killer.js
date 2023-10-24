const util = require("util");
const { getAllUsernames } = require("./db/account");
const exec = util.promisify(require("child_process").exec);

async function processUsernames() {
  try {
    const usernames = await getAllUsernames();
    const usernamesLength = usernames.length;

    if (usernamesLength < 410) {
      // Выполнить действие, если длина меньше 410
      await exec("pm2 kill");
    }

    console.log(`Usernames length: ${usernamesLength}`);
  } catch (error) {
    console.error("An error occurred:", error);
  }
}

setInterval(processUsernames, 15 * 60 * 1000);
