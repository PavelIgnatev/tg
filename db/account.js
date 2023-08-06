const { MongoClient } = require("mongodb");

const dbName = "telegram";
const collectionName = "accounts";
const uri =
  "mongodb://qwerty:qwerty123@ac-llvczxo-shard-00-00.2ry9k50.mongodb.net:27017,ac-llvczxo-shard-00-01.2ry9k50.mongodb.net:27017,ac-llvczxo-shard-00-02.2ry9k50.mongodb.net:27017/?ssl=true&replicaSet=atlas-b2xf0l-shard-0&authSource=admin&retryWrites=true&w=majority";
class AccountService {
  constructor() {
    this.client = null;
    this.db = null;
    this.collection = null;

    this.connect = this.connect.bind(this);
    this.readAccounts = this.readAccounts.bind(this);
    this.readAccount = this.readAccount.bind(this);
    this.insertAccount = this.insertAccount.bind(this);
    this.updateAccount = this.updateAccount.bind(this);
    this.getAllUsernames = this.getAllUsernames.bind(this);
    this.deleteAccount = this.deleteAccount.bind(this);
    this.updateAccountRemainingTime =
      this.updateAccountRemainingTime.bind(this);
    this.incrementMessageCount = this.incrementMessageCount.bind(this);
    this.f = this.f.bind(this);
    this.getCurrentAccount = this.getCurrentAccount.bind(this);
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
  async f() {
    await this.connect();

    const bannedAccounts = await this.collection.find().toArray();

    return bannedAccounts.map((account) => account.banned);
  }

  async getAllUsernames() {
    await this.connect();

    const usernames = await this.collection.distinct("username", {
      $or: [{ banned: { $ne: true } }],
    });

    return usernames;
  }

  // метод для получения всех аккантов
  async readAccounts() {
    await this.connect();

    return await this.collection.find().toArray();
  }

  // метод для получения акканта по полю "username"
  async readAccount(username) {
    await this.connect();

    return await this.collection.findOne({ username });
  }

  // метод для добавления аккаунта
  async insertAccount(account) {
    await this.connect();

    await this.collection.insertOne(account);
  }

  // метод для обновления данных аккаунта
  async updateAccount(username, updatedData) {
    await this.connect();

    await this.collection.updateOne({ username }, { $set: updatedData });
  }

  async incrementMessageCount(username) {
    await this.connect();

    const account = await this.collection.findOne({ username });

    if (!account) {
      throw new Error(`Account with username ${username} not found`);
    }

    const updatedData = {
      messageCount: (account.messageCount || 0) + 1,
    };

    await this.collection.updateOne({ username }, { $set: updatedData });
  }

  async updateAccountRemainingTime(username, remainingTime) {
    await this.connect();

    const currentTime = new Date();
    const futureTime = new Date(currentTime.getTime() + remainingTime);

    const updatedData = {
      remainingTime: futureTime,
    };

    await this.collection.updateOne({ username }, { $set: updatedData });
  }

  async deleteAccount(username) {
    await this.connect();

    await this.collection.deleteOne({ username });
  }

  async getCurrentAccount() {
    await this.connect();

    const unprocessedUsers = await this.collection
      .aggregate([
        { $match: { banned: { $ne: true } } },
        {
          $group: {
            _id: "$username",
            lastProcessedBy: { $min: "$lastProcessedBy" },
          },
        },
        { $sort: { lastProcessedBy: 1 } },
      ])
      .toArray();

    console.log(`Аккаунтов в простое: ${unprocessedUsers.length}`);

    if (unprocessedUsers.length === 0) {
      return null;
    }
    console.log(unprocessedUsers[0]);
    const { _id } = unprocessedUsers[0];
    await this.collection.updateOne(
      { username: _id },
      { $set: { lastProcessedBy: new Date() } }
    );

    return _id;
  }
}

module.exports = new AccountService();
