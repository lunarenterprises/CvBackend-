const formidable = require("formidable");
const fs = require("fs");
const pdfParse = require("@cedrugs/pdf-parse");
const pdfjsLib = require("pdfjs-dist"); // ✅ Works perfectly with v3.11.174

const MANDATORY_SECTIONS = [
  "PROFESSIONAL SUMMARY",
  "WORK EXPERIENCE",
  "EDUCATION",
  "SKILLS",
  "LANGUAGES",
];

const CORRECT_ORDER = [
  "PROFESSIONAL SUMMARY",
  "WORK EXPERIENCE",
  "EDUCATION",
  "SKILLS",
  "CORE COMPETENCIES",
  "CERTIFICATIONS",
  "LANGUAGES",
];

class RezoonATSScorer {
  constructor() {
    this.score = 100;
    this.issues = [];
    this.hasPhoto = false;
    this.hasColoredBG = false;
    this.isRezoonTemplate = false;
    this.text = "";
    this.lines = [];
  }

  async scan(filePath) {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      this.text = data.text || "";
      this.lines = this.text
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      this.hasPhoto = await this.detectPhoto(filePath);
      this.hasColoredBG = await this.detectColoredBackground(filePath);
      this.checkRezoonTemplate();
      this.applyAllRules();
      this.applyHardCapsAndBonus();



      const finalScore = Math.max(0, Math.min(100, this.score));

      return {
        company: "Rezoon Digital",
        atsScore: finalScore,
        passed: finalScore >= 90,
        isRezoonTemplate: this.isRezoonTemplate,
        hasPhoto: this.hasPhoto,
        hasColoredBackground: this.hasColoredBG,
        message:
          finalScore >= 90
            ? "PASSED! 90+ Only with Official Rezoon Template"
            : `Score: ${finalScore}/100 – Use Official Template`,
        issues: this.issues.length > 0 ? this.issues : ["Perfect CV!"],
      };
    } catch (err) {
      console.error("Scan Error:", err);
      return {
        atsScore: 0,
        message: "PDF Error",
        issues: ["Processing failed"],
      };
    }
  }

  async detectPhoto(filePath) {
    try {
      const pdfData = fs.readFileSync(filePath);
      const uint8Data = new Uint8Array(pdfData);
      const pdf = await pdfjsLib.getDocument({ data: uint8Data }).promise;

      const page = await pdf.getPage(1);
      const ops = await page.getOperatorList();

      return ops.fnArray.some(
        (fn) =>
          fn === pdfjsLib.OPS.paintImageXObject ||
          fn === pdfjsLib.OPS.paintJpegXObject
      );
    } catch (err) {
      console.log("Photo detection error:", err.message);
      return false;
    }
  }

  async detectColoredBackground(filePath) {
    try {
      const pdfData = fs.readFileSync(filePath);
      const uint8Data = new Uint8Array(pdfData);
      const pdf = await pdfjsLib.getDocument({ data: uint8Data }).promise;

      for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
        const page = await pdf.getPage(i);
        const ops = await page.getOperatorList();

        for (let j = 0; j < ops.fnArray.length; j++) {
          if (
            ops.fnArray[j] === pdfjsLib.OPS.setFillColor ||
            ops.fnArray[j] === pdfjsLib.OPS.setFillColorN
          ) {
            const color = ops.argsArray[j][0];
            const isWhite =
              Array.isArray(color) && color.every((c) => c >= 0.98);
            if (!isWhite) return true;
          }
        }
      }
    } catch (err) {
      console.log("BG detection error:", err.message);
    }
    return false;
  }

  checkRezoonTemplate() {
    const markers = ["Inter", "Size 12", "size 8.6", "50–80 words"];
    const hasAll = markers.every((m) => this.text.includes(m));
    const nameRule = this.lines
      .slice(0, 20)
      .some((l) => /Name.*Inter.*Size 12/i.test(l));
    this.isRezoonTemplate = hasAll && nameRule;

    if (!this.isRezoonTemplate) {
      this.score = Math.min(this.score, 85);
      this.issues.push("Not using official Rezoon Digital template → Max 85");
    }
  }

  applyAllRules() {
    // Professional Summary 50–80 words
    const sumIdx = this.lines.findIndex((l) =>
      /PROFESSIONAL SUMMARY/i.test(l)
    );
    if (sumIdx !== -1) {
      let words = 0;
      for (let i = sumIdx + 1; i < this.lines.length; i++) {
        if (/^[A-Z\s]{8,}$/.test(this.lines[i])) break;
        words += this.lines[i].split(/\s+/).length;
      }
      if (words < 50 || words > 80) {
        this.score -= 10;
        this.issues.push(`Summary: ${words} words (must 50–80) → -10`);
      }
    }

    // Mandatory sections
    MANDATORY_SECTIONS.forEach((sec) => {
      if (!this.lines.some((l) => l.toUpperCase().includes(sec))) {
        this.score -= 10;
        this.issues.push(`Missing: ${sec} → -10`);
      }
    });

    // Section order
    let last = -1;
    CORRECT_ORDER.forEach((sec) => {
      const idx = this.lines.findIndex((l) => l.toUpperCase().includes(sec));
      if (idx !== -1 && idx < last) {
        this.score -= 5;
        this.issues.push(`Wrong order: ${sec} → -5`);
      }
      if (idx !== -1) last = idx;
    });

    const hasBullets = this.lines.some((l) => /^[•●◦\-–]/.test(l));
    if (!hasBullets) {
      this.score -= 5;
      this.issues.push("No bullet points → -5");
    }
    if (!this.text.includes("Inter")) {
      this.score -= 5;
      this.issues.push("Font not Inter → -5");
    }
  }

  applyHardCapsAndBonus() {
    if (this.hasPhoto) {
      this.score = Math.min(this.score, 90);
      this.issues.push("Photo detected → Max score: 90");
    }
    if (this.hasColoredBG) {
      this.score -= 30;
      this.score = Math.min(this.score, 60);
      this.issues.push("Colored background → -30 & Max score: 60");
    }
    if (!this.isRezoonTemplate) this.score = Math.min(this.score, 85);

    if (
      this.score >= 95 &&
      this.isRezoonTemplate &&
      !this.hasPhoto &&
      !this.hasColoredBG
    ) {
      this.score += 5;
      this.issues.push("Perfect Rezoon format → +5 bonus");
    }
  }
}

module.exports = async (req, res) => {
  // Ensure uploads directory exists
  const uploadDir = "uploads";
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
  }

  const form = new formidable.IncomingForm({
    uploadDir: uploadDir,
    keepExtensions: true,
    filename: (name, ext, part, form) => {
      return `${Date.now()}_${part.originalFilename.replace(/\s+/g, "_")}`;
    },
  });

  form.parse(req, async (err, fields, files) => {
    if (err || !files.cv) {
      return res.status(400).json({ error: "Upload file with key: cv" });
    }

    const file = Array.isArray(files.cv) ? files.cv[0] : files.cv;
    const filePath = file && file.filepath;

    if (!filePath) {
      return res.status(400).json({ error: "Invalid uploaded file" });
    }

    const filename = file.newFilename; // formidable v3 uses newFilename
    const baseUrl = process.env.APP_URL || "https://lunarsenterprises.com:7005";
    const pdfUrl = `${baseUrl}/uploads/${filename}`;

    const scorer = new RezoonATSScorer();
    const result = await scorer.scan(filePath);

    // Merge result with pdfUrl
    res.json({
      ...result,
      pdfUrl,
    });
  });
};
