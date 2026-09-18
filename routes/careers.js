
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

import pool from "../db.js";

const router = express.Router();

/* =========================================================
   CV UPLOAD CONFIGURATION
========================================================= */

const uploadDirectory = "uploads/career-applications";

if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirectory);
  },

  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname);

    const safeName = file.originalname
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9.-]/g, "");

    cb(
      null,
      `${Date.now()}-${safeName || `cv${extension}`}`
    );
  },
});

const upload = multer({
  storage,

  limits: {
    fileSize: 5 * 1024 * 1024,
  },

  fileFilter: (req, file, cb) => {
    const allowedExtensions = [".pdf", ".doc", ".docx"];

    const extension = path
      .extname(file.originalname)
      .toLowerCase();

    if (!allowedExtensions.includes(extension)) {
      return cb(
        new Error(
          "Only PDF, DOC and DOCX CV files are allowed."
        )
      );
    }

    cb(null, true);
  },
});


/* =========================================================
   GET ALL CAREERS
   GET /api/careers
========================================================= */

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM careers
      ORDER BY created_at DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching careers:", err);

    res.status(500).json({
      error: "Server error while fetching careers.",
    });
  }
});


/* =========================================================
   GET PUBLISHED CAREERS
   GET /api/careers/public
========================================================= */

router.get("/public", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM careers
      WHERE is_published = true
      ORDER BY created_at DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error(
      "❌ Error fetching published careers:",
      err
    );

    res.status(500).json({
      error: "Server error while fetching published careers.",
    });
  }
});


/* =========================================================
   GET ALL CAREER APPLICATIONS
   GET /api/careers/applications
========================================================= */

router.get("/applications", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        ca.*,
        c.title AS career_title
      FROM career_applications ca
      LEFT JOIN careers c
        ON ca.career_id = c.id
      ORDER BY ca.created_at DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error(
      "❌ Error fetching career applications:",
      err
    );

    res.status(500).json({
      error: "Server error while fetching applications.",
    });
  }
});


/* =========================================================
   GET SINGLE APPLICATION
   GET /api/careers/applications/:id
========================================================= */

router.get("/applications/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        ca.*,
        c.title AS career_title
      FROM career_applications ca
      LEFT JOIN careers c
        ON ca.career_id = c.id
      WHERE ca.id = $1
      `,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Application not found.",
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(
      "❌ Error fetching application:",
      err
    );

    res.status(500).json({
      error: "Server error while fetching application.",
    });
  }
});


/* =========================================================
   SUBMIT CAREER APPLICATION
   POST /api/careers/applications
========================================================= */

router.post(
  "/applications",
  upload.single("cv"),
  async (req, res) => {
    try {
      const {
        career_id,
        applicant_name,
        email,
        phone,
        cover_letter,
      } = req.body;

      if (!career_id || !applicant_name || !email) {
        return res.status(400).json({
          error:
            "Career, applicant name and email are required.",
        });
      }

      // Make sure the selected career exists
      // and is currently published.
      const careerResult = await pool.query(
        `
        SELECT id
        FROM careers
        WHERE id = $1
          AND is_published = true
        `,
        [career_id]
      );

      if (careerResult.rows.length === 0) {
        return res.status(404).json({
          error:
            "The selected career is no longer available.",
        });
      }

      const cvUrl = req.file
        ? `/uploads/career-applications/${req.file.filename}`
        : null;

      const result = await pool.query(
        `
        INSERT INTO career_applications (
          career_id,
          applicant_name,
          email,
          phone,
          cover_letter,
          cv_url,
          status,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          NOW(),
          NOW()
        )
        RETURNING *
        `,
        [
          career_id,
          applicant_name.trim(),
          email.trim(),
          phone || null,
          cover_letter || null,
          cvUrl,
          "pending",
        ]
      );

      res.status(201).json({
        message: "Application submitted successfully.",
        application: result.rows[0],
      });
    } catch (err) {
      console.error(
        "❌ Error submitting career application:",
        err
      );

      res.status(500).json({
        error: "Server error while submitting application.",
      });
    }
  }
);


/* =========================================================
   UPDATE APPLICATION STATUS
   PATCH /api/careers/applications/:id/status
========================================================= */

router.patch(
  "/applications/:id/status",
  async (req, res) => {
    try {
      const { status } = req.body;

      const allowedStatuses = [
        "pending",
        "reviewing",
        "shortlisted",
        "rejected",
        "hired",
      ];

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          error: "Invalid application status.",
        });
      }

      const result = await pool.query(
        `
        UPDATE career_applications
        SET
          status = $1,
          updated_at = NOW()
        WHERE id = $2
        RETURNING *
        `,
        [status, req.params.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: "Application not found.",
        });
      }

      res.json(result.rows[0]);
    } catch (err) {
      console.error(
        "❌ Error updating application status:",
        err
      );

      res.status(500).json({
        error:
          "Server error while updating application status.",
      });
    }
  }
);


/* =========================================================
   DELETE APPLICATION
   DELETE /api/careers/applications/:id
========================================================= */

router.delete(
  "/applications/:id",
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        DELETE FROM career_applications
        WHERE id = $1
        RETURNING id
        `,
        [req.params.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: "Application not found.",
        });
      }

      res.json({
        message: "Application deleted successfully.",
      });
    } catch (err) {
      console.error(
        "❌ Error deleting application:",
        err
      );

      res.status(500).json({
        error: "Server error while deleting application.",
      });
    }
  }
);


/* =========================================================
   GET SINGLE CAREER
   GET /api/careers/:id
========================================================= */

router.get("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT *
      FROM careers
      WHERE id = $1
      `,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Career not found.",
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(
      "❌ Error fetching career:",
      err
    );

    res.status(500).json({
      error: "Server error while fetching career.",
    });
  }
});


/* =========================================================
   CREATE CAREER
   POST /api/careers
========================================================= */

router.post("/", async (req, res) => {
  try {
    const {
      title,
      department,
      employment_type,
      location,
      short_description,
      description,
      requirements,
      application_email,
      application_url,
      deadline,
      is_published,
    } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        error: "Title and description are required.",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO careers (
        title,
        department,
        employment_type,
        location,
        short_description,
        description,
        requirements,
        application_email,
        application_url,
        deadline,
        is_published,
        created_at,
        updated_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        NOW(),
        NOW()
      )
      RETURNING *
      `,
      [
        title.trim(),
        department || null,
        employment_type || null,
        location || null,
        short_description || null,
        description,
        requirements || null,
        application_email || null,
        application_url || null,
        deadline || null,
        is_published === true ||
          is_published === "true",
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(
      "❌ Error adding career:",
      err
    );

    res.status(500).json({
      error: "Server error while adding career.",
    });
  }
});


/* =========================================================
   UPDATE CAREER
   PUT /api/careers/:id
========================================================= */

router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const {
      title,
      department,
      employment_type,
      location,
      short_description,
      description,
      requirements,
      application_email,
      application_url,
      deadline,
      is_published,
    } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        error: "Title and description are required.",
      });
    }

    const result = await pool.query(
      `
      UPDATE careers
      SET
        title = $1,
        department = $2,
        employment_type = $3,
        location = $4,
        short_description = $5,
        description = $6,
        requirements = $7,
        application_email = $8,
        application_url = $9,
        deadline = $10,
        is_published = $11,
        updated_at = NOW()
      WHERE id = $12
      RETURNING *
      `,
      [
        title.trim(),
        department || null,
        employment_type || null,
        location || null,
        short_description || null,
        description,
        requirements || null,
        application_email || null,
        application_url || null,
        deadline || null,
        is_published === true ||
          is_published === "true",
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Career not found.",
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(
      "❌ Error updating career:",
      err
    );

    res.status(500).json({
      error: "Server error while updating career.",
    });
  }
});


/* =========================================================
   DELETE CAREER
   DELETE /api/careers/:id
========================================================= */

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      DELETE FROM careers
      WHERE id = $1
      RETURNING id
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Career not found.",
      });
    }

    res.json({
      message: "Career deleted successfully.",
    });
  } catch (err) {
    console.error(
      "❌ Error deleting career:",
      err
    );

    res.status(500).json({
      error: "Server error while deleting career.",
    });
  }
});


/* =========================================================
   MULTER ERROR HANDLER
========================================================= */

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        error:
          "CV file is too large. Maximum size is 5MB.",
      });
    }

    return res.status(400).json({
      error: err.message,
    });
  }

  if (err) {
    return res.status(400).json({
      error:
        err.message || "File upload error.",
    });
  }

  next();
});


export default router;

