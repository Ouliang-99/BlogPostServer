import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import dataRoutes from "./routes/data.js"; // Default Import

// โหลด Environment Variables
dotenv.config();

// เริ่มต้น Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// เรียกใช้ API routes
app.use("/api", dataRoutes);

// เริ่มต้นเซิร์ฟเวอร์
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
