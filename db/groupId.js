const { MongoClient } = require("mongodb");

const dbName = "telegram";
const collectionName = "groupId";
const uri =
  "mongodb://qwerty:qwerty123@ac-llvczxo-shard-00-00.2ry9k50.mongodb.net:27017,ac-llvczxo-shard-00-01.2ry9k50.mongodb.net:27017,ac-llvczxo-shard-00-02.2ry9k50.mongodb.net:27017/?ssl=true&replicaSet=atlas-b2xf0l-shard-0&authSource=admin&retryWrites=true&w=majority";

class groupIdService {
  constructor() {
    this.client = null;
    this.db = null;
    this.collection = null;

    this.connect = this.connect.bind(this);
    this.createGroupId = this.createGroupId.bind(this);
    this.createOrUpdateCurrentCount =
      this.createOrUpdateCurrentCount.bind(this);
    this.getGroupId = this.getGroupId.bind(this);
    this.findByGroupId = this.findByGroupId.bind(this);
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

  async createGroupId(target, database = [], propmpts = {}) {
    await this.connect();

   return  await this.collection.insertOne({
      groupId: Math.floor(Math.random() * 10 ** 10) + 10 ** 10,
      target,
      currentCount: 0,
      database,
      propmpts,
      dateCreated: new Date(),
    });
  }

  async createOrUpdateCurrentCount(groupId) {
    await this.connect();

    const filter = { groupId: groupId };
    const update = {
      $inc: { currentCount: 1 },
      $set: { dateUpdated: new Date() },
    };
    const options = { upsert: true };

    await this.collection.updateOne(filter, update, options);
  }

  async findByGroupId(groupId) {
    await this.connect();

    const filter = { groupId: groupId };
    const foundDoc = await this.collection.findOne(filter);

    return foundDoc;
  }

  async getGroupId() {
    await this.connect();

    const fullDocs = await this.collection.find().toArray();
    const docs = fullDocs.filter((doc) => doc.currentCount < doc.target);
    let currentIndex = docs.findIndex((doc) => doc.current === true);

    if (currentIndex === -1) {
      currentIndex = 0;
    }

    await this.collection.updateOne(
      { _id: docs[currentIndex]._id },
      { $unset: { current: "" } }
    );

    const nextIndex = (currentIndex + 1) % docs.length;
    const nextDoc = docs[nextIndex];

    await this.collection.updateOne(
      { _id: nextDoc._id },
      { $set: { current: true } }
    );

    return nextDoc;
  }
}

module.exports = new groupIdService();
