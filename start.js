const { getProxies } = require("./db/proxy");
const util = require("util");
const exec = util.promisify(require("child_process").exec);

const startInstances = async () => {
  const proxies = await getProxies();
  console.log(proxies);

  for (let i = 0; i < proxies.length; i++) {
    const server = proxies[i].server;
    delete proxies[i]["_id"];

    const buildCommand = (server, params) => {
      const paramStrings = Object.entries(params).map(
        ([key, value]) => `--${key} ${value}`
      );

      return `pm2 start main.js --name ${server} -- ${paramStrings.join(" ")}`;
    };

    const command = buildCommand(server, proxies[i]);

    try {
      const result = await exec(command);
      if (result.stderr) {
        console.error(
          `Ошибка запуска main.js для сервера ${server}: ${result.stderr}`
        );
      } else {
        console.log(`main.js для сервера ${server} успешно запущен.`);
      }
    } catch (error) {
      console.error(`Ошибка запуска main.js для сервера ${server}: ${error}`);
    }
  }

  process.exit(1);
};

startInstances();
