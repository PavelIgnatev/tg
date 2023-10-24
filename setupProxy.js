const { getUsernames } = require("./db/account");
const { getProxies } = require("./db/proxy");
const { insertAccount } = require("./db/account");

const setupProxy = async () => {
  const usernames = await getUsernames();
  const proxies = await getProxies();

  let proxyIndex = 0;

  for (const username of usernames) {
    console.log(username);
    const account = {
      username,
      server: proxies[proxyIndex].server,
    };

    await insertAccount(account);

    proxyIndex = (proxyIndex + 1) % proxies.length;
  }
};

setupProxy();
