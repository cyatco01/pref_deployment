const fs = require("fs");
const express = require("express");
const path = require("path");
const brain = require("brain.js");

function convertCsvToTextSamples(filePath) {
  const csvContent = fs.readFileSync(filePath, "utf-8");
  const rows = csvContent.split(/\r?\n/).filter(row => row.trim() !== "");
  const headers = rows.shift().split(",").map(header => header.trim());

  const requiredColumns = ['Overview', 'Sentiment_Score', 'Valence_Score', 'Arousal_Score', 'Dominance_Score', 'Tempo'];
  for (let column of requiredColumns) {
    if (!headers.includes(column)) {
      throw new Error(`Missing required column: ${column}`);
    }
  }

  return rows.map(row => {
    const values = row.match(/(".*?"|[^",]+|(?<=,)(?=,))/g).map(value =>
      value.replace(/^"|"$/g, "").trim()
    );

    const rowData = {};
    headers.forEach((header, index) => {
      const value = values[index];
      rowData[header] = isNaN(value) ? value : parseFloat(value);
    });

    return {
      text: rowData['Overview'],
      sentiment: parseFloat(rowData['Sentiment_Score']),
      valence: parseFloat(rowData['Valence_Score']),
      arousal: parseFloat(rowData['Arousal_Score']),
      dominance: parseFloat(rowData['Dominance_Score']),
      tempo: parseFloat(rowData['Tempo']),
    };
  });
}

let moviesData;
try {
  moviesData = convertCsvToTextSamples("./movies_training.csv");
  console.log("Movies Data Loaded:", moviesData.slice(0, 5));
} catch (err) {
  console.error("Error loading CSV:", err);
}

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  const htmlFile = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

  const injectedHtml = htmlFile.replace(
    '<script type="application/json" id="movies-data"></script>',
    `<script type="application/json" id="movies-data">${JSON.stringify(moviesData)}</script>`
  );

  res.send(injectedHtml);
});

app.get("/test", (req, res) => {
  res.json(moviesData.slice(0, 5));
});

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

const net = new brain.NeuralNetwork();
let trainingData = [];

app.post("/train", (req, res) => {
  if (trainingData.length === 0) {
    return res.status(400).send("No training data available.");
  }

  net.train(trainingData, { iterations: 2000, errorThresh: 0.005 });
  const layers = net.toJSON().layers;

  const weightsAndBiases = layers.map((layer, index) => ({
    layer: index,
    weights: layer.weights || null,
    biases: layer.biases || null,
  }));

  res.json(weightsAndBiases);
});

app.use("/favicon.ico", express.static(path.join(__dirname, "favicon.ico")));
app.use(express.static(path.join(__dirname)));

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
