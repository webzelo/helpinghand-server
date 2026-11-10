import express from 'express'
import { MongoClient, ObjectId } from 'mongodb';
import 'dotenv/config'
import cors from "cors"
import { createRemoteJWKSet, jwtVerify } from "jose";

const app = express()
const port = 5000

app.use(cors())
app.use(express.json())

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
//Working
const mongoClient = await connectToMongoDB()

const db = mongoClient.db("helpinghand")
const eventCollection = db.collection("event")
const eventJoinCollection = db.collection("event_join")

await eventJoinCollection.createIndex(
    { eventId: 1, userId: 1 },
    { unique: true }
)


const JWKS = createRemoteJWKSet(
    new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
);

const verifyApi = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).send({ msg: "Unauthorized!" });
    }

    const token = authHeader.split(" ")[1];

    try {
        const { payload } = await jwtVerify(token, JWKS)
        req.user = payload
        next();
    } catch {
        return res.status(401).send({ msg: "Invalid Token!" })
    }
};


app.post('/create-event', verifyApi, async(req, res) =>{

    const data = req.body

    const result = await eventCollection.insertOne(data)
    console.log(result)

    res.send(result)
})



app.get('/manage-events', verifyApi, async(req, res) => {
    const result = await eventCollection.find().toArray()
    res.send(result)
})

app.get('/featured-upcoming-events', async(req, res) => {
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    const result = await eventCollection
        .find({ eventDate: { $gte: today } })
        .sort({ eventDate: 1 })
        .limit(6)
        .toArray()

    res.send(result)
})

// Public: upcoming events only, soonest first.
app.get('/events', async(req, res) => {
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    const result = await eventCollection
        .find({ eventDate: { $gte: today } })
        .sort({ eventDate: 1 })
        .toArray()

    res.send(result)
})

const getEventById = async(req, res) => {
    const { id } = req.params

    if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: 'Invalid event id.' })
    }

    const result = await eventCollection.findOne({ _id: new ObjectId(id) })

    if (!result) {
        return res.status(404).send({ message: 'Event not found.' })
    }

    res.send(result)
}

// Public: anyone can read an event's details.
app.get('/events/:id', getEventById)

app.get('/manage-events/:id', verifyApi, getEventById)

app.patch('/manage-events/:id', verifyApi, async(req, res) => {
    const { id } = req.params

    if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: 'Invalid event id.' })
    }

    // Never let the client change the document id.
    const { _id, ...updates } = req.body

    const result = await eventCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updates }
    )

    if (result.matchedCount === 0) {
        return res.status(404).send({ message: 'Event not found.' })
    }

    res.send(result)
})

app.delete('/manage-events/:id', verifyApi, async(req, res) => {
    const { id } = req.params

    if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: 'Invalid event id.' })
    }

    const result = await eventCollection.deleteOne({ _id: new ObjectId(id) })

    if (result.deletedCount === 0) {
        return res.status(404).send({ message: 'Event not found.' })
    }

    res.send(result)
})

app.patch('/manage-events/:id/join', verifyApi, async(req, res) => {
    const { id } = req.params
    const { joined } = req.body

    if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: 'Invalid event id.' })
    }

    // Use the verified token, never a userId supplied by the client.
    const userId = req.user?.sub ?? req.user?.id

    if (!userId) {
        return res.status(401).send({ message: 'Unauthorized!' })
    }

    try {
        const result = await eventCollection.updateOne(
            { _id: new ObjectId(id) },
            joined
                ? { $addToSet: { participants: userId } }
                : { $pull: { participants: userId } }
        )

        if (result.matchedCount === 0) {
            return res.status(404).send({ message: 'Event not found.' })
        }

        if (joined) {
            await eventJoinCollection.updateOne(
                { eventId: new ObjectId(id), userId },
                {
                    $set: {
                        eventId: new ObjectId(id),
                        userId,
                        name: req.user?.name ?? '',
                        email: req.user?.email ?? '',
                        joinedAt: new Date(),
                    },
                },
                { upsert: true }
            )
        } else {
            await eventJoinCollection.deleteOne({
                eventId: new ObjectId(id),
                userId,
            })
        }

        res.send(result)
    } catch (error) {
        console.dir(error)
        res.status(500).send({ message: 'Could not update this event.' })
    }
})


app.get('/', (req, res) => {
  res.send({message: 'Server Is Running Fine!'})
})

app.listen(port, () => {
  console.log(`Server is running at ${port}`)
});

export default app