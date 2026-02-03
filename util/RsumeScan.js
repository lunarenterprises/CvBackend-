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
    this.hasInterFont = false;
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
      this.hasInterFont = await this.detectFonts(filePath); // New Check
      this.checkRezoonTemplate();
      this.applyAllRules();
      this.applyHardCapsAndBonus();



      const finalScore = Math.max(0, Math.min(100, this.score));
      console.log(this.hasColoredBG);
      return {
        company: "Rezoon Digital",
        atsScore: finalScore,
        passed: finalScore >= 90,
        isRezoonTemplate: this.isRezoonTemplate,
        hasPhoto: this.hasPhoto,
        hasColoredBackground: this.hasColoredBG,
        hasInterFont: this.hasInterFont,
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
        console.log(`[BG Debug] Page ${i} Ops: ${ops.fnArray.length}`);

        // Default state: Black (0,0,0) as per PDF spec
        let r = 0, g = 0, b = 0;

        // Debug: Log all unique ops on this page
        const seenOps = new Set();
        ops.fnArray.forEach(fn => {
          const opName = Object.keys(pdfjsLib.OPS).find(k => pdfjsLib.OPS[k] === fn);
          if (opName) seenOps.add(opName);
        });
        console.log(`[BG Debug] Unique Ops on Page ${i}:`, Array.from(seenOps).join(", "));

        for (let j = 0; j < ops.fnArray.length; j++) {
          const fn = ops.fnArray[j];
          const args = ops.argsArray[j];

          // 1. Track Color Changes (Non-Stroking / Fill Color)
          if (
            fn === pdfjsLib.OPS.setFillColor ||
            fn === pdfjsLib.OPS.setFillColorN
          ) {
            if (args.length === 1) {
              // Grayscale
              r = g = b = args[0];
            } else if (args.length === 3) {
              // RGB
              r = args[0];
              g = args[1];
              b = args[2];
            } else if (args.length === 4) {
              // CMYK
              const c = args[0], m = args[1], y = args[2], k = args[3];
              r = (1 - c) * (1 - k);
              g = (1 - m) * (1 - k);
              b = (1 - y) * (1 - k);
            }
          }

          // 2. Check Fill Operations (Used for backgrounds/shapes)
          // OPS.fill (f), OPS.eoFill (f*)
          if (fn === pdfjsLib.OPS.fill || fn === pdfjsLib.OPS.eoFill) {
            console.log(`[BG Debug] Fill Op: ${fn}, Color: ${r}, ${g}, ${b}`);
            // Check if "Non-White"
            const isWhite = r >= 0.95 && g >= 0.95 && b >= 0.95;
            if (!isWhite) {
              console.log("[BG Debug] DETECTED COLORED BG!");
              return true;
            }
          }

          if (fn === pdfjsLib.OPS.shadingFill) {
            console.log("[BG Debug] Shading Fill Detected!");
            return true;
          }
        }
      }
    } catch (err) {
      console.log("BG detection error:", err.message);
    }
    return false;
  }

  async detectFonts(filePath) {
    try {
      const pdfData = fs.readFileSync(filePath);
      const uint8Data = new Uint8Array(pdfData);
      const pdf = await pdfjsLib.getDocument({ data: uint8Data }).promise;

      for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const fontFaces = new Set();

        // Collect all font references from text items
        for (const item of textContent.items) {
          if (item.fontName) {
            const font = page.commonObjs.get(item.fontName);
            if (font && font.name) {
              fontFaces.add(font.name);
            }
          }
        }

        // check if any font is part of Inter family
        for (const fontName of fontFaces) {
          if (fontName.toLowerCase().includes("inter")) {
            return true;
          }
        }
      }
    } catch (err) {
      console.log("Font detection error:", err.message);
    }
    return false; // No Inter found
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

    // Section order (Strict Check)
    const positions = {};
    CORRECT_ORDER.forEach((sec) => {
      const idx = this.lines.findIndex((l) => l.toUpperCase().includes(sec));
      if (idx !== -1) positions[sec] = idx;
    });

    CORRECT_ORDER.forEach((sec, expectedIndex) => {
      if (positions[sec] === undefined) return;

      const currentPos = positions[sec];
      let isWrong = false;

      // Check predecessors (should be above)
      for (let i = 0; i < expectedIndex; i++) {
        const pred = CORRECT_ORDER[i];
        if (positions[pred] !== undefined && positions[pred] > currentPos) {
          isWrong = true;
          break;
        }
      }

      // Check successors (should be below)
      if (!isWrong) {
        for (let i = expectedIndex + 1; i < CORRECT_ORDER.length; i++) {
          const succ = CORRECT_ORDER[i];
          if (positions[succ] !== undefined && positions[succ] < currentPos) {
            isWrong = true;
            break;
          }
        }
      }

      if (isWrong) {
        this.score -= 5;
        this.issues.push(`Wrong order: ${sec} → -5`);
      }
    });

    const hasBullets = this.lines.some((l) => /^[•●◦\-–]/.test(l));
    if (!hasBullets) {
      this.score -= 5;
      this.issues.push("No bullet points → -5");
    }
    if (!this.hasInterFont) {
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
