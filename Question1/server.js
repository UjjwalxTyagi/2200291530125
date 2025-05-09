const express = require("express")
const mongoose = require("mongoose")
const cors = require("cors")
const axios = require("axios")
require("dotenv").config()

const app = express()
const PORT = process.env.PORT || 9876
const WINDOW_SIZE = 10

// Middleware
app.use(cors())
app.use(express.json())

// MongoDB Schema
const numberSchema = new mongoose.Schema({
  numbers: [Number],
  type: String,
  timestamp: { type: Date, default: Date.now },
})

const NumberModel = mongoose.model("Number", numberSchema)

// Helper: Calculate average
const calculateAverage = (numbers) => {
  if (numbers.length === 0) return 0
  return numbers.reduce((a, b) => a + b, 0) / numbers.length
}

// Helper: Fetch numbers from test server
const fetchNumbers = async (type) => {
  const endpoints = {
    p: "http://20.244.56.144/evaluation-service/primes",
    f: "http://20.244.56.144/evaluation-service/fibo",
    e: "http://20.244.56.144/evaluation-service/even",
    r: "http://20.244.56.144/evaluation-service/rand",
  }

  try {
    const response = await axios.get(endpoints[type], { timeout: 500 })
    return response.data.numbers || []
  } catch (error) {
    console.error(`Error fetching ${type} numbers:`, error.message)
    return []
  }
}

// Main Route
app.get("/numbers/:type", async (req, res) => {
  const { type } = req.params
  const validTypes = ["p", "f", "e", "r"]

  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: "Invalid number type" })
  }

  try {
    const previousState = await NumberModel.findOne({ type })
      .sort({ timestamp: -1 })
      .limit(1)

    const windowPrevState = previousState ? previousState.numbers : []
    const newNumbers = await fetchNumbers(type)

    // Deduplicate and maintain order
    const seen = new Set()
    const combined = [...windowPrevState, ...newNumbers]
    const deduped = []

    for (let num of combined) {
      if (!seen.has(num)) {
        seen.add(num)
        deduped.push(num)
      }
    }

    const windowCurrState = deduped.slice(-WINDOW_SIZE)

    // Save to DB
    await NumberModel.create({
      numbers: windowCurrState,
      type,
    })

    const avg = calculateAverage(windowCurrState)

    res.json({
      windowPrevState,
      windowCurrState,
      numbers: newNumbers,
      avg: avg.toFixed(2),
    })
  } catch (error) {
    console.error("Error processing request:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Start server and connect DB
mongoose
  .connect(
    process.env.MONGODB_URI ||
      "mongodb+srv://ujjwaltyagi1205:Tyagi1205@cluster0.i0ojrrj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
  )
  .then(() => {
    console.log("Connected to MongoDB")
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`)
    })
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error)
  })
