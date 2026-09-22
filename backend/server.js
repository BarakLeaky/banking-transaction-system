import "dotenv/config";
import express from "express";
import cors from "cors";
import "./database.js";
import authRoutes from "./src/routes/auth.js";
import accountRoutes from "./src/routes/accounts.js";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "banking-backend" });
});

app.use("/api/auth", authRoutes);
app.use("/api/accounts", accountRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Banking backend running on http://localhost:${PORT}`);
});
