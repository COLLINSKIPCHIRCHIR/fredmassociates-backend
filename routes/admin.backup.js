import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../db.js";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();

router.get("/test", (req, res) => {
  res.send("✅ Admin route working");
});


console.log("✅ Admin router loaded");


// ✅ Admin signup
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if admin already exists
    const checkAdmin = await pool.query("SELECT * FROM admins WHERE email = $1", [email]);
    if (checkAdmin.rows.length > 0) {
      return res.status(400).json({ message: "Admin already exists" });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new admin
    const newAdmin = await pool.query(
      "INSERT INTO admins (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email",
      [name, email, hashedPassword]
    );

    res.status(201).json({ message: "Admin created successfully", admin: newAdmin.rows[0] });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Admin login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find admin
    const admin = await pool.query("SELECT * FROM admins WHERE email = $1", [email]);
    if (admin.rows.length === 0) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Compare password
    const validPassword = await bcrypt.compare(password, admin.rows[0].password);
    if (!validPassword) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: admin.rows[0].id, email: admin.rows[0].email },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({ message: "Login successful", token });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Protected route example (dashboard)
router.get("/me", verifyToken, async (req, res) => {
  try {
    const admin = await pool.query("SELECT id, name, email FROM admins WHERE id = $1", [req.admin.id]);
    res.json(admin.rows[0]);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Middleware to verify token
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  jwt.verify(token, process.env.JWT_SECRET, (err, admin) => {
    if (err) return res.status(403).json({ message: "Invalid token" });
    req.admin = admin;
    next();
  });
}

export default router;
