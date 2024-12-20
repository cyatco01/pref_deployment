const fs = require("fs");
const express = require("express");
const path = require("path");
const brain = require("brain.js");

// Load movie data from JSON
let moviesData;
try {
  const dataPath = path.join(__dirname, "movies_training.json");
  moviesData = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  if (!moviesData || moviesData.length === 0) {
    throw new Error("Movies data is empty or invalid.");
  }
  console.log("Movies Data Loaded:", moviesData.slice(0, 5)); // Debug log
} catch (err) {
  console.error("Error loading JSON:", err);
  moviesData = []; // Fallback to an empty array
}

const app = express();
app.use(express.json()); // Middleware for parsing JSON in POST requests

// Serve HTML with embedded JSON
app.get("/", (req, res) => {
  const htmlFile = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

  const injectedHtml = htmlFile.replace(
    '<script type="application/json" id="movies-data"></script>',
    `<script type="application/json" id="movies-data">${
      moviesData.length > 0 ? JSON.stringify(moviesData) : "[]"
    }</script>`
  );

  res.send(injectedHtml);
});

// Debug route to view JSON data
app.get("/test", (req, res) => {
  res.json(moviesData.slice(0, 5)); // Serve the first 5 rows for debugging
});

// Initialize Neural Network
const net = new brain.NeuralNetwork();
let trainingData = [];

// Endpoint to add user feedback to training data
app.post("/add-feedback", (req, res) => {
  const { preferredText, notPreferredText } = req.body;

  if (!preferredText || !notPreferredText) {
    return res.status(400).send("Both preferredText and notPreferredText are required.");
  }

  trainingData.push({
    input: {
      sentiment: preferredText.sentiment,
      valence: preferredText.valence,
      arousal: preferredText.arousal,
      dominance: preferredText.dominance,
      tempo: preferredText.tempo,
    },
    output: { liked: 1 },
  });

  trainingData.push({
    input: {
      sentiment: notPreferredText.sentiment,
      valence: notPreferredText.valence,
      arousal: notPreferredText.arousal,
      dominance: notPreferredText.dominance,
      tempo: notPreferredText.tempo,
    },
    output: { liked: 0 },
  });

  res.send({ message: "Feedback added successfully." });
});

// Endpoint to train the neural network and extract weights
app.post("/train", (req, res) => {
  if (trainingData.length === 0) {
    return res.status(400).send("No training data available.");
  }

  net.train(trainingData, {
    iterations: 2000,
    errorThresh: 0.005,
  });

  const layers = net.toJSON().layers;
  const weightsAndBiases = layers.map((layer, index) => ({
    layer: index,
    weights: layer.weights || null,
    biases: layer.biases || null,
  }));

  res.json(weightsAndBiases);
});

// Serve static files
app.use(express.static(path.join(__dirname)));

// Start the server
const PORT = 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
