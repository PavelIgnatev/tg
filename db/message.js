const { MongoClient } = require("mongodb");

const dbName = "telegram";
const collectionName = "messages";
const uri =
  "mongodb://qwerty:qwerty123@ac-llvczxo-shard-00-00.2ry9k50.mongodb.net:27017,ac-llvczxo-shard-00-01.2ry9k50.mongodb.net:27017,ac-llvczxo-shard-00-02.2ry9k50.mongodb.net:27017/?ssl=true&replicaSet=atlas-b2xf0l-shard-0&authSource=admin&retryWrites=true&w=majority";

class MessageService {
  constructor() {
    this.client = null;
    this.db = null;
    this.collection = null;

    this.connect = this.connect.bind(this);
    this.readMessage = this.readMessage.bind(this);
    this.insertMessage = this.insertMessage.bind(this);
    this.updateMessage = this.updateMessage.bind(this);
    this.deleteMessage = this.deleteMessage.bind(this);
    this.getSentMessages = this.getSentMessages.bind(this);
    this.getAllUsernames = this.getAllUsernames.bind(this);
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

  // метод для получения последнего неотправленного сообщения
  async readMessage() {
    await this.connect();

    const message = await this.collection
      .find({ send: { $ne: true }, failed: { $ne: true } })
      .sort({ count: -1 })
      .limit(1)
      .next();

    return message;
  }
  async getAllUsernames() {
    await this.connect();

    const usernames = await this.collection.distinct("username");
    return usernames;
  }

  async getSentMessages() {
    await this.connect();

    const sentMessages = await this.collection.find({ send: true }).toArray();

    return sentMessages;
  }

  // метод для добавления новой отправки на сообщение
  async insertMessage(message) {
    await this.connect();

    // const existingMessage = await this.collection.findOne({
    //   username: message.username,
    // });
    // if (existingMessage) {
    //   return;
    // }

    await this.collection.updateOne(
      { username: message.username },
      { $set: message },
      { upsert: true }
    );
  }

  // метод для обновления состояния отправки сообщения
  async updateMessage(username, defaultSet = { send: true }) {
    await this.connect();

    await this.collection.updateOne({ username }, { $set: defaultSet });
  }

  async deleteMessage(username) {
    await this.connect();

    await this.collection.deleteOne({ username });
  }
}

module.exports = new MessageService();
