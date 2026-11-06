import express from 'express'
import { MongoClient } from 'mongodb';
import 'dotenv/config'


const app = express()
const port = 5000


const client = new MongoClient(process.env.MONGODB_URL);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}

connectToMongoDB()

//http://localhost:5000

app.get('/', (req, res) => {
  res.send({message: 'Server Is Running Fine!'})
})

app.listen(port, () => {
  console.log(`Server is running at ${port}`)
})