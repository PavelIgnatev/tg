const {
  getAllUsernames,
  getServerCounts,
  readAccounts,
} = require("./db/account");

getServerCounts().then(console.log);
getAllUsernames();
readAccounts().then(async (e) => {
  await new Promise((res) => setTimeout(res, 15000));
  e.forEach((k) => {
    console.log(k.username, Boolean(k.fullBanned), k.messageCount);
  });
});
