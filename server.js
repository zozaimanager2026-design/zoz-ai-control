const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const ZOZ_NAME = process.env.ZOZ_NAME || "ZOZ AI";

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));

// Vercel invokes the exported Express app as a serverless function.
// Keep local development support without calling app.listen() in Vercel.
if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`${ZOZ_NAME} running on port ${PORT}`));
}

module.exports = app;
