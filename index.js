// index.js
const express = require("express");
const cors = require("cors");
const resumeRoute = require("./router");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/scan", resumeRoute);

// Home Page
app.get("/", (req, res) => {
  res.send(`
    <div style="text-align:center;margin-top:80px;font-family:Arial;">
      <h1 style="color:green;">REZOON DIGITAL ATS SCANNER</h1>
      <h2>POST → <code>http://localhost:3000/scan/resume</code></h2>
      <p><strong>Key:</strong> cv | <strong>Type:</strong> File | <strong>Accept:</strong> .pdf</p>
      <h3 style="color:red;">90+ ONLY WITH OFFICIAL REZOON TEMPLATE</h3>
    </div>
  `);
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`\nREZOON DIGITAL ATS LIVE → http://localhost:${PORT}`);
  console.log(`Upload CV → POST /scan/resume (form-data, key: cv)\n`);
});