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

  async addAccount(accountString) {
    await this.connect();

    const [url, port, login, password] = accountString.split(":");
    const account = {
      server: `${url}:${port}`,
      username: login,
      password: password,
    };

    const existingAccount = await this.collection.findOne({
      server: account.server,
      username: account.username,
      password: account.password,
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
}

module.exports = new ProxyService();
