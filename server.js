import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import dataRoutes from "./routes/data.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use("/api", dataRoutes);

// ไม่ต้องใช้ app.listen() บน Vercel
export default app;
