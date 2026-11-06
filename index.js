import express from 'express'

const app = express()
const port = 5000


//http://localhost:5000

app.get('/', (req, res) => {
  res.send({message: 'Server Is Running Fine!'})
})

app.listen(port, () => {
  console.log(`Server is running at ${port}`)
})