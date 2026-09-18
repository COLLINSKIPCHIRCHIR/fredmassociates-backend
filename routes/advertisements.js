import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import pool from "../db.js";

const router = express.Router();

const uploadsDir = path.join(
  process.cwd(),
  "uploads",
  "advertisements"
);

const mobileUploadsDir = path.join(
  process.cwd(),
  "uploads",
  "advertisements",
  "mobile"
);


if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

if (!fs.existsSync(mobileUploadsDir)) {
  fs.mkdirSync(mobileUploadsDir, { recursive: true });
}


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

const mobileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, mobileUploadsDir);
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

const mobileUpload = multer({
  storage: mobileStorage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

/*
|--------------------------------------------------------------------------
| Public routes
|--------------------------------------------------------------------------
*/

// Get currently active advertisements
router.get("/public/active", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM advertisements
      WHERE is_active = TRUE
        AND (start_date IS NULL OR start_date <= NOW())
        AND (end_date IS NULL OR end_date >= NOW())
      ORDER BY created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching active advertisements:", error);

    res.status(500).json({
      message: "Failed to fetch advertisements.",
    });
  }
});

// Get active popup advertisement
router.get("/public/popup", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM advertisements
      WHERE is_active = TRUE
        AND display_mode IN ('popup', 'both')
        AND (start_date IS NULL OR start_date <= NOW())
        AND (end_date IS NULL OR end_date >= NOW())
      ORDER BY created_at DESC
      LIMIT 1
    `);

    res.json(result.rows[0] || null);
  } catch (error) {
    console.error("Error fetching popup advertisement:", error);

    res.status(500).json({
      message: "Failed to fetch popup advertisement.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| Admin routes
|--------------------------------------------------------------------------
*/

// Get all advertisements
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM advertisements
      ORDER BY created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching advertisements:", error);

    res.status(500).json({
      message: "Failed to fetch advertisements.",
    });
  }
});

// Upload advertisement image
router.post(
  "/upload-image",
  upload.single("image"),
  (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          message: "Please select an image.",
        });
      }

      const imageUrl =
        `/uploads/advertisements/${req.file.filename}`;

      res.status(201).json({
        message: "Advertisement image uploaded successfully.",
        image_url: imageUrl,
      });
    } catch (error) {
      console.error(
        "Error uploading advertisement image:",
        error
      );

      res.status(500).json({
        message: "Failed to upload advertisement image.",
      });
    }
  }
);

router.post(
  "/upload-mobile-image",
  mobileUpload.single("image"),
  (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          message: "Please select a mobile banner image.",
        });
      }

      const imageUrl =
        `/uploads/advertisements/mobile/${req.file.filename}`;

      res.status(201).json({
        message:
          "Mobile advertisement image uploaded successfully.",
        image_url: imageUrl,
      });
    } catch (error) {
      console.error(
        "Error uploading mobile advertisement image:",
        error
      );

      res.status(500).json({
        message:
          "Failed to upload mobile advertisement image.",
      });
    }
  }
);

// Create advertisement
router.post("/", async (req, res) => {
  try {
    const {
  title,
  description,
  image_url,
  mobile_image_url,
  button_text,
  button_url,
  position,
  display_mode,
  start_date,
  end_date,
  is_active,
} = req.body;

   

    const result = await pool.query(
      `
      INSERT INTO advertisements (
  title,
  description,
  image_url,
  mobile_image_url,
  button_text,
  button_url,
  position,
  display_mode,
  start_date,
  end_date,
  is_active
)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *
      `,
      [
  title,
  description || null,
  image_url || null,
  mobile_image_url || null,
  button_text || null,
  button_url || null,
  position || "homepage",
  display_mode || "banner",
  start_date || null,
  end_date || null,
  is_active === true || is_active === "true",
]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating advertisement:", error);

    res.status(500).json({
      message: "Failed to create advertisement.",
    });
  }
});

// Update advertisement
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const {
      title,
      description,
      image_url,
      mobile_image_url,
      button_text,
      button_url,
      position,
      display_mode,
      start_date,
      end_date,
      is_active,
    } = req.body;

    const result = await pool.query(
      `
      UPDATE advertisements
      SET
        title = $1,
        description = $2,
        image_url = $3,
        mobile_image_url = $4,
        button_text = $5,
        button_url = $6,
        position = $7,
        display_mode = $8,
        start_date = $9,
        end_date = $10,
        is_active = $11,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $12
      RETURNING *
      `,
      [
        title,
        description || null,
        image_url || null,
        mobile_image_url || null,
        button_text || null,
        button_url || null,
        position || "homepage",
        display_mode || "banner",
        start_date || null,
        end_date || null,
        is_active === true || is_active === "true",
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Advertisement not found.",
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating advertisement:", error);

    res.status(500).json({
      message: "Failed to update advertisement.",
    });
  }
});

// Delete advertisement
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      DELETE FROM advertisements
      WHERE id = $1
      RETURNING *
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Advertisement not found.",
      });
    }

    res.json({
      message: "Advertisement deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting advertisement:", error);

    res.status(500).json({
      message: "Failed to delete advertisement.",
    });
  }
});

export default router;