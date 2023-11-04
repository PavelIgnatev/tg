const { getAllUsernames, getServerCounts, readAccounts } = require("./db/account");

getAllUsernames().then((e) => console.log(e.length));
getServerCounts().then(console.log);
readAccounts().then((e) => {
  // console.log(e.slice(126).length)
  e.forEach((k) => {
    // console.log(k.messageCount);
    // if (k.banned) {
      console.log(k.banned, k.messageCount);
    // }
  });
});
// // 1
