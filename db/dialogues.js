const { MongoClient } = require("mongodb");

const dbName = "telegram";
const collectionName = "dialogues";
const uri =
  "mongodb://qwerty:qwerty123@ac-llvczxo-shard-00-00.2ry9k50.mongodb.net:27017,ac-llvczxo-shard-00-01.2ry9k50.mongodb.net:27017,ac-llvczxo-shard-00-02.2ry9k50.mongodb.net:27017/?ssl=true&replicaSet=atlas-b2xf0l-shard-0&authSource=admin&retryWrites=true&w=majority";

class DialoguesService {
  constructor() {
    this.client = null;
    this.db = null;
    this.collection = null;

    this.connect = this.connect.bind(this);

    this.postDialogue = this.postDialogue.bind(this);
    this.getDialogue = this.getDialogue.bind(this);
    this.getDialogueUsername = this.getDialogueUsername.bind(this);
    this.getUsernamesByGroupId = this.getUsernamesByGroupId.bind(this);
    this.convertUsernamesToLowerCase =
      this.convertUsernamesToLowerCase.bind(this);
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

  async postDialogue(dialogue) {
    await this.connect();

    await this.collection.updateOne(
      { accountId: dialogue.accountId, href: dialogue.href },
      { $set: dialogue },
      { upsert: true }
    );
  }

  // получание по
  async getDialogue(accountId, href) {
    await this.connect();
    return await this.collection.findOne({ accountId, href });
  }

  async getDialogueUsername(accountId, username) {
    await this.connect();
    return await this.collection.findOne({
      accountId,
      username: username.toLowerCase(),
    });
  }

  // все пользователи, которым была отправка по конкретному groupId
  async getUsernamesByGroupId(groupId) {
    await this.connect();

    const dialogues = await this.collection.find({ groupId }).toArray();
    return dialogues.map((dialogue) => dialogue?.username?.toLowerCase()).filter(Boolean);
  }

  async convertUsernamesToLowerCase() {
    await this.connect();

    // Получаем все диалоги
    const dialogues = await this.collection.find().toArray();

    // Проходимся по каждому диалогу
    for (const dialogue of dialogues) {
      // Проверяем, есть ли у диалога поле "username"
      if (dialogue.username) {
        // Преобразуем значение поля "username" в нижний регистр
        dialogue.username = dialogue.username.toLowerCase();

        // Обновляем диалог с новым значением поля "username"
        await this.collection.updateOne(
          { _id: dialogue._id },
          { $set: { username: dialogue.username } }
        );
      }
    }
    console.log('все')
  }
}

module.exports = new DialoguesService();
