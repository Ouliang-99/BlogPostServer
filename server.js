import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import dataRoutes from "./routes/data.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// กำหนด origins ที่อนุญาต
const allowedOrigins = [
  "http://localhost:5173", // สำหรับ development
  "http://localhost:3000",
  "https://oleang-blog-project.vercel.app", // ใส่ domain ของ frontend ที่ deploy บน Vercel
];

// ตั้งค่า CORS แบบละเอียด
app.use(
  cors({
    origin: function (origin, callback) {
      // allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) === -1) {
        const msg =
          "The CORS policy for this site does not allow access from the specified Origin.";
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(express.json());

app.use("/api", dataRoutes);

// สำหรับ debug
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

// เพิ่ม health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

export default app;
