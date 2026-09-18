import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import pool from "../db.js";

const router = express.Router();

// --------------------------------------------------
// UPLOAD DIRECTORY
// --------------------------------------------------

const uploadsDir = path.join(
  process.cwd(),
  "uploads",
  "updates"
);

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}


// --------------------------------------------------
// MULTER STORAGE
// --------------------------------------------------

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },

  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname);

    const baseName = path
      .basename(file.originalname, extension)
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .replace(/-+/g, "-")
      .toLowerCase();

    cb(
      null,
      `${Date.now()}-${baseName}${extension}`
    );
  },
});


// --------------------------------------------------
// IMAGE FILTER
// --------------------------------------------------

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed."));
  }
};


const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});


// --------------------------------------------------
// IMAGE UPLOAD
// --------------------------------------------------

router.post("/upload-image", upload.single("image"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "Please select an image.",
      });
    }

    const imageUrl = `/uploads/updates/${req.file.filename}`;

    res.status(201).json({
      message: "Image uploaded successfully.",
      image_url: imageUrl,
    });

  } catch (error) {
    console.error("Error uploading image:", error);

    res.status(500).json({
      message: "Failed to upload image.",
    });
  }
});


// --------------------------------------------------
// PUBLIC ACTIVE UPDATES
// --------------------------------------------------

router.get("/public/active", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM updates
      WHERE is_published = TRUE
      ORDER BY created_at DESC
    `);

    res.json(result.rows);

  } catch (error) {
    console.error("Error fetching public updates:", error);

    res.status(500).json({
      message: "Failed to fetch public updates",
    });
  }
});


// --------------------------------------------------
// CURRENT POPUP
// --------------------------------------------------

router.get("/public/popup", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM updates
      WHERE
        is_published = TRUE
        AND show_popup = TRUE
        AND (
          popup_start_date IS NULL
          OR popup_start_date <= CURRENT_TIMESTAMP
        )
        AND (
          popup_end_date IS NULL
          OR popup_end_date >= CURRENT_TIMESTAMP
        )
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return res.json(null);
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error("Error fetching popup:", error);

    res.status(500).json({
      message: "Failed to fetch popup",
    });
  }
});


// --------------------------------------------------
// GET ALL UPDATES
// --------------------------------------------------

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM updates
      ORDER BY created_at DESC
    `);

    res.json(result.rows);

  } catch (error) {
    console.error("Error fetching updates:", error);

    res.status(500).json({
      message: "Failed to fetch updates",
    });
  }
});


// --------------------------------------------------
// GET SINGLE UPDATE
// --------------------------------------------------

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT *
      FROM updates
      WHERE id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Update not found",
      });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error("Error fetching update:", error);

    res.status(500).json({
      message: "Failed to fetch update",
    });
  }
});


// --------------------------------------------------
// CREATE UPDATE
// --------------------------------------------------

router.post("/", async (req, res) => {
  try {
    const {
      title,
      slug,
      category,
      summary,
      content,
      image_url,
      author,
      seo_title,
      seo_description,
      is_published,
      is_featured,
      show_popup,
      popup_start_date,
      popup_end_date,
    } = req.body;

    if (
      !title ||
      !slug ||
      !category ||
      !summary ||
      !content
    ) {
      return res.status(400).json({
        message:
          "Title, slug, category, summary and content are required",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO updates (
        title,
        slug,
        category,
        summary,
        content,
        image_url,
        author,
        seo_title,
        seo_description,
        is_published,
        is_featured,
        show_popup,
        popup_start_date,
        popup_end_date
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
        $12,
        $13,
        $14
      )
      RETURNING *
      `,
      [
        title,
        slug,
        category,
        summary,
        content,
        image_url || null,
        author || null,
        seo_title || null,
        seo_description || null,
        is_published === "true" || is_published === true,
        is_featured === "true" || is_featured === true,
        show_popup === "true" || show_popup === true,
        popup_start_date || null,
        popup_end_date || null,
      ]
    );

    res.status(201).json({
      message: "Update created successfully",
      update: result.rows[0],
    });

  } catch (error) {
    console.error("Error creating update:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        message: "An update with this slug already exists",
      });
    }

    res.status(500).json({
      message: "Failed to create update",
    });
  }
});


// --------------------------------------------------
// UPDATE EXISTING UPDATE
// --------------------------------------------------

router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const {
      title,
      slug,
      category,
      summary,
      content,
      image_url,
      author,
      seo_title,
      seo_description,
      is_published,
      is_featured,
      show_popup,
      popup_start_date,
      popup_end_date,
    } = req.body;

    if (
      !title ||
      !slug ||
      !category ||
      !summary ||
      !content
    ) {
      return res.status(400).json({
        message:
          "Title, slug, category, summary and content are required",
      });
    }

    const result = await pool.query(
      `
      UPDATE updates
      SET
        title = $1,
        slug = $2,
        category = $3,
        summary = $4,
        content = $5,
        image_url = $6,
        author = $7,
        seo_title = $8,
        seo_description = $9,
        is_published = $10,
        is_featured = $11,
        show_popup = $12,
        popup_start_date = $13,
        popup_end_date = $14,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $15
      RETURNING *
      `,
      [
        title,
        slug,
        category,
        summary,
        content,
        image_url || null,
        author || null,
        seo_title || null,
        seo_description || null,
        is_published === "true" || is_published === true,
        is_featured === "true" || is_featured === true,
        show_popup === "true" || show_popup === true,
        popup_start_date || null,
        popup_end_date || null,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Update not found",
      });
    }

    res.json({
      message: "Update updated successfully",
      update: result.rows[0],
    });

  } catch (error) {
    console.error("Error updating update:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        message: "An update with this slug already exists",
      });
    }

    res.status(500).json({
      message: "Failed to update update",
    });
  }
});


// --------------------------------------------------
// DELETE UPDATE
// --------------------------------------------------

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      DELETE FROM updates
      WHERE id = $1
      RETURNING id
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Update not found",
      });
    }

    res.json({
      message: "Update deleted successfully",
    });

  } catch (error) {
    console.error("Error deleting update:", error);

    res.status(500).json({
      message: "Failed to delete update",
    });
  }
});


export default router;