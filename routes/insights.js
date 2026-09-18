import express from "express";
import multer from "multer";
import path from "path";
import pool from "../db.js";

const router = express.Router();

// =====================================================
// IMAGE UPLOAD
// =====================================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/insights");
  },

  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname);
    cb(null, `${Date.now()}${extension}`);
  },
});

const upload = multer({
  storage,
});

// =====================================================
// GET ALL INSIGHTS
// =====================================================

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM insights
      ORDER BY created_at DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching insights:", err);

    res.status(500).json({
      error: "Server error",
    });
  }
});

// =====================================================
// GET LATEST 4 PUBLISHED INSIGHTS
// =====================================================

router.get("/latest", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM insights
      WHERE is_published = true
      ORDER BY created_at DESC
      LIMIT 4
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching latest insights:", err);

    res.status(500).json({
      error: "Server error fetching latest insights",
    });
  }
});

// =====================================================
// GET SINGLE INSIGHT BY SLUG
// =====================================================

router.get("/slug/:slug", async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT *
      FROM insights
      WHERE slug = $1
        AND is_published = true
      LIMIT 1
      `,
      [req.params.slug]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Insight not found",
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching insight by slug:", err);

    res.status(500).json({
      error: "Server error",
    });
  }
});

// =====================================================
// GET SINGLE INSIGHT BY ID
// =====================================================

router.get("/id/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT *
      FROM insights
      WHERE id = $1
      `,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Insight not found",
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching insight:", err);

    res.status(500).json({
      error: "Server error",
    });
  }
});

// =====================================================
// CREATE INSIGHT
// =====================================================

router.post(
  "/",
  upload.single("image"),
  async (req, res) => {
    try {
      const {
        title,
        slug,
        summary,
        content,
        seo_title,
        seo_description,
        is_published,
      } = req.body;

      if (!title || !slug || !content) {
        return res.status(400).json({
          error: "Title, slug and content are required.",
        });
      }

      const imageUrl = req.file
        ? `/uploads/insights/${req.file.filename}`
        : null;

      const result = await pool.query(
        `
        INSERT INTO insights (
          title,
          slug,
          summary,
          content,
          image_url,
          seo_title,
          seo_description,
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
          NOW(),
          NOW()
        )
        RETURNING *
        `,
        [
          title.trim(),
          slug.trim(),
          summary || "",
          content,
          imageUrl,
          seo_title || null,
          seo_description || null,
          is_published === "true" || is_published === true,
        ]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("Error creating insight:", err);

      res.status(500).json({
        error: "Server error while creating insight",
      });
    }
  }
);

// =====================================================
// UPDATE INSIGHT
// =====================================================

router.put(
  "/:id",
  upload.single("image"),
  async (req, res) => {
    try {
      const { id } = req.params;

      const {
        title,
        slug,
        summary,
        content,
        seo_title,
        seo_description,
        is_published,
      } = req.body;

      if (!title || !slug || !content) {
        return res.status(400).json({
          error: "Title, slug and content are required.",
        });
      }

      let query;
      let values;

      // -------------------------------------------------
      // UPDATE WITH NEW IMAGE
      // -------------------------------------------------

      if (req.file) {
        const imageUrl = `/uploads/insights/${req.file.filename}`;

        query = `
          UPDATE insights
          SET
            title = $1,
            slug = $2,
            summary = $3,
            content = $4,
            image_url = $5,
            seo_title = $6,
            seo_description = $7,
            is_published = $8,
            updated_at = NOW()
          WHERE id = $9
          RETURNING *
        `;

        values = [
          title.trim(),
          slug.trim(),
          summary || "",
          content,
          imageUrl,
          seo_title || null,
          seo_description || null,
          is_published === "true" || is_published === true,
          id,
        ];
      }

      // -------------------------------------------------
      // UPDATE WITHOUT CHANGING IMAGE
      // -------------------------------------------------

      else {
        query = `
          UPDATE insights
          SET
            title = $1,
            slug = $2,
            summary = $3,
            content = $4,
            seo_title = $5,
            seo_description = $6,
            is_published = $7,
            updated_at = NOW()
          WHERE id = $8
          RETURNING *
        `;

        values = [
          title.trim(),
          slug.trim(),
          summary || "",
          content,
          seo_title || null,
          seo_description || null,
          is_published === "true" || is_published === true,
          id,
        ];
      }

      const result = await pool.query(query, values);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: "Insight not found",
        });
      }

      res.json(result.rows[0]);
    } catch (err) {
      console.error("Error updating insight:", err);

      res.status(500).json({
        error: "Server error while updating insight",
      });
    }
  }
);

// =====================================================
// DELETE INSIGHT
// =====================================================

router.delete("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `
      DELETE FROM insights
      WHERE id = $1
      RETURNING id
      `,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Insight not found",
      });
    }

    res.json({
      message: "Insight deleted successfully",
    });
  } catch (err) {
    console.error("Error deleting insight:", err);

    res.status(500).json({
      error: "Server error",
    });
  }
});

export default router;