// routes/resumeRoute.js
const express = require("express");
const router = express.Router();
const uploadCV = require("./util/RsumeScan");

router.post("/resume", uploadCV);

module.exports = router;