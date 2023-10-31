const { MongoClient } = require("mongodb");
const { Mutex } = require("async-mutex");

const dbName = "telegram";
const collectionName = "accounts";
const uri =
  "mongodb://qwerty:qwerty123@ac-llvczxo-shard-00-00.2ry9k50.mongodb.net:27017,ac-llvczxo-shard-00-01.2ry9k50.mongodb.net:27017,ac-llvczxo-shard-00-02.2ry9k50.mongodb.net:27017/?ssl=true&replicaSet=atlas-b2xf0l-shard-0&authSource=admin&retryWrites=true&w=majority";
class AccountService {
  lock = new Mutex();

  constructor() {
    this.client = null;
    this.db = null;
    this.collection = null;

    this.connect = this.connect.bind(this);
    this.readAccounts = this.readAccounts.bind(this);
    this.readAccount = this.readAccount.bind(this);
    this.insertAccount = this.insertAccount.bind(this);
    this.updateAccount = this.updateAccount.bind(this);
    this.insertAccount2 = this.insertAccount2.bind(this);
    this.getAllUsernames = this.getAllUsernames.bind(this);
    this.getUsernames = this.getUsernames.bind(this);
    this.deleteAccount = this.deleteAccount.bind(this);
    this.updateAccountRemainingTime =
      this.updateAccountRemainingTime.bind(this);
    this.incrementMessageCount = this.incrementMessageCount.bind(this);
    this.f = this.f.bind(this);
    this.getCurrentAccount = this.getCurrentAccount.bind(this);
    this.deleteBannedAccounts = this.deleteBannedAccounts.bind(this);
    this.removeAllFieldFromAccounts =
      this.removeAllFieldFromAccounts.bind(this);
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

    const bannedAccounts = await this.collection
      .find({ banned: true })
      .toArray();

    return bannedAccounts.map((account) => account);
  }

  async getAllUsernames() {
    await this.connect();

    const usernames = await this.collection.distinct("username", {
      $or: [{ banned: { $ne: true } }],
    });

    return usernames;
  }

  async getUsernames() {
    await this.connect();

    const usernames = await this.collection.distinct("username");

    return usernames;
  }

  async deleteBannedAccounts() {
    await this.connect();

    await this.collection.deleteMany({ banned: true });
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

    const filter = { username: account.username };
    const update = { $set: account };
    const options = { upsert: true };

    await this.collection.updateOne(filter, update, options);
  }

  async insertAccount2(account) {
    await this.connect();

    // Проверяем, есть ли объект с полем 'banned: true' для данного 'username'
    const filter = { username: account.username, banned: true };
    const existingBannedAccount = await this.collection.findOne(filter);

    // Если такой объект существует, выполняем вставку
    if (existingBannedAccount) {
      const update = { $set: account };
      const options = { upsert: true };
      await this.collection.updateOne(filter, update, options);
    } else {
      // Выводим сообщение или выбрасываем ошибку, так как вставка не разрешена
      console.log(
        "Нельзя вставить аккаунт. Отсутствует объект с полем banned: true."
      );
      // Или можно выбросить ошибку, например:
      // throw new Error('Нельзя вставить аккаунт. Отсутствует объект с полем banned: true.');
    }
  }

  async removeAllFieldFromAccounts(fieldToRemove) {
    await this.connect();

    const update = { $unset: { [fieldToRemove]: 1 } }; // Удаляем указанное поле

    // Обновляем все документы, удаляя указанное поле
    await this.collection.updateMany({}, update);
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

  async getCurrentAccount(server, threadCount) {
    await this.lock.acquire();

    await this.connect();

    const unprocessedUsers = await this.collection
      .aggregate([
        // { $match: { banned: { $ne: true } } },
        { $match: { server, banned: true  } },
        {
          $group: {
            _id: "$username",
            lastProcessedBy: { $min: "$lastProcessedBy" },
            remainingTime: { $min: "$remainingTime" },
            banned: { $min: "$banned" },
          },
        },
        { $sort: { lastProcessedBy: 1 } },
      ])
      .toArray();

    if (
      unprocessedUsers.length === 0 ||
      unprocessedUsers.length < threadCount
    ) {
      this.lock.release();

      return null;
    }
    const currentDate = new Date();
    for (const user of unprocessedUsers) {
      if (user.remainingTime && !user.banned) {
        const remainingDate = new Date(user.remainingTime);
        if (remainingDate < currentDate) {
          const index = unprocessedUsers.indexOf(user);
          unprocessedUsers.splice(index, 1);
          unprocessedUsers.unshift(user);
          break;
        }
      }
    }

    console.log(unprocessedUsers[0]);
    const { _id } = unprocessedUsers[0];
    await this.collection.updateOne(
      { username: _id },
      { $set: { lastProcessedBy: new Date() } }
    );

    this.lock.release();

    return _id;
  }
}

module.exports = new AccountService();
