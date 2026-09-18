import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from "path";
import { fileURLToPath } from "url";

import insightsRouter from './routes/insights.js';
import adminRouter from "./routes/admin.js";
import careersRouter from "./routes/careers.js";
import updatesRouter from './routes/updates.js';
import advertisementsRouter from "./routes/advertisements.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "https://fredmassociates.com",
    "https://www.fredmassociates.com"
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json());

// Static uploads folder
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Routes
app.use('/api/insights', insightsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/careers", careersRouter);
app.use("/api/updates", updatesRouter);
app.use("/api/advertisements", advertisementsRouter);

console.log("✅ Routes loaded");

const PORT = process.env.PORT || 5002;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});