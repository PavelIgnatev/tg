const { MongoClient } = require("mongodb");

const dbName = "telegram";
const collectionName = "proxy";
const uri =
  "mongodb://qwerty:qwerty123@ac-llvczxo-shard-00-00.2ry9k50.mongodb.net:27017,ac-llvczxo-shard-00-01.2ry9k50.mongodb.net:27017,ac-llvczxo-shard-00-02.2ry9k50.mongodb.net:27017/?ssl=true&replicaSet=atlas-b2xf0l-shard-0&authSource=admin&retryWrites=true&w=majority";
class ProxyService {
  constructor() {
    this.client = null;
    this.db = null;
    this.collection = null;

    this.connect = this.connect.bind(this);
    this.addAccount = this.addAccount.bind(this);
    this.getProxies = this.getProxies.bind(this);
    this.assignAccountId = this.assignAccountId.bind(this);
  }

  async connect() {
    if (this.client) {
      return;
    }

    this.client = await MongoClient.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    this.db = this.client.db(dbName);
    this.collection = this.db.collection(collectionName);
  }

  async getProxies() {
    await this.connect();

    return await this.collection.find().toArray();
  }

  async addAccount(accountString) {
    await this.connect();

    const [url, port, login, password, urlChange] = accountString.split(":");

    const account = {
      server: `${url}:${port}`,
      username: login,
      password: password.replace("|https", ""),
      changeUrl: "https:" + urlChange,
    };

    const existingAccount = await this.collection.findOne({
      server: account.server,
      username: account.username,
      password: account.password,
      changeUrl: account.changeUrl,
    });

    if (existingAccount) {
      console.log("Account already exists:", existingAccount);
      return existingAccount;
    } else {
      const result = await this.collection.insertOne(account);
      console.log("New account added:", account);
      return result;
    }
  }

  async assignAccountId(accountId) {
    await this.connect();

    // Проверяем, есть ли уже привязанный прокси с данным accountId
    const existingAccount = await this.collection.findOne({ accountId });
    if (existingAccount) {
      console.log(
        `Proxy already assigned to account ${accountId}:`,
        existingAccount
      );
      return existingAccount;
    }

    const freeProxy = await this.collection.findOne(
      { accountId: null },
      { sort: { _id: -1 } }
    );
    if (freeProxy) {
      await this.collection.updateOne(
        { _id: freeProxy._id },
        { $set: { accountId } }
      );
      console.log(`Proxy assigned to account ${accountId}:`, freeProxy);
      return freeProxy;
    }

    console.log(`No free proxy available for account ${accountId}`);
    return null;
  }
}

module.exports = new ProxyService();
