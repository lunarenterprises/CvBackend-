// Load environment variables
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const https = require("https");
const fs = require("fs");
const resumeRoute = require("./router");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/scan", resumeRoute);
app.use("/uploads", express.static("uploads"));

// Home Page
app.get("/", (req, res) => {
  res.send(`
    <div style="text-align:center;margin-top:80px;font-family:Arial;">
      <h1 style="color:green;">REZOON DIGITAL ATS SCANNER</h1>
      <h2>POST → <code>/scan/resume</code></h2>
      <p><strong>Key:</strong> cv | <strong>Type:</strong> File | <strong>Accept:</strong> .pdf</p>
      <h3 style="color:red;">90+ ONLY WITH OFFICIAL REZOON TEMPLATE</h3>
    </div>
  `);
});

const PORT = 7005;

// SSL Configuration
if (process.env.NODE_ENV === "production") {
  try {
    const privateKey = fs.readFileSync(process.env.SSL_PRIVATE_KEY, "utf8");
    const certificate = fs.readFileSync(process.env.SSL_CERTIFICATE, "utf8");
    const ca = fs.readFileSync(process.env.SSL_CA_BUNDLE, "utf8");

    const credentials = { key: privateKey, cert: certificate, ca: ca };
    const httpsServer = https.createServer(credentials, app);

    httpsServer.listen(PORT, () => {
      console.log(`HTTPS Server running on port ${PORT}`);
      console.log(`\nREZOON DIGITAL ATS LIVE (HTTPS) → https://lunarsenterprises.com:${PORT}`);
      console.log(`Upload CV → POST /scan/resume (form-data, key: cv)\n`);
    });
  } catch (err) {
    console.error("Error starting HTTPS server: " + err.message);
    console.log("Falling back to HTTP...");
    app.listen(PORT, () => {
      console.log("Server running on " + PORT);
      // console.log(`\nREZOON DIGITAL ATS LIVE (HTTP) → http://localhost:${PORT}`);
      console.log(`Upload CV → POST /scan/resume (form-data, key: cv)\n`);
    });
  }
} else {
  app.listen(PORT, () => {
    console.log("Server running on " + PORT);
    console.log(`\nREZOON DIGITAL ATS LIVE (HTTP) → http://localhost:${PORT}`);
    console.log(`Upload CV → POST /scan/resume (form-data, key: cv)\n`);
  });
}