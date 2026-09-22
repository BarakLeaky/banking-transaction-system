import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import db from "../../database.js";

const router = express.Router();

router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password || password.length < 6) {
    return res.status(400).json({ message: "Name, email and a password of at least 6 characters are required" });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const result = db.prepare(
      "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)"
    ).run(name.trim(), email.trim().toLowerCase(), hash);

    const token = jwt.sign(
      { id: result.lastInsertRowid, email: email.trim().toLowerCase() },
      process.env.JWT_SECRET || "dev-secret",
      { expiresIn: "8h" }
    );

    res.status(201).json({ token, user: { id: result.lastInsertRowid, name, email } });
  } catch (error) {
    if (String(error.message).includes("UNIQUE")) {
      return res.status(409).json({ message: "Email is already registered" });
    }
    res.status(500).json({ message: "Registration failed" });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email?.trim().toLowerCase());

  if (!user || !(await bcrypt.compare(password || "", user.password_hash))) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET || "dev-secret",
    { expiresIn: "8h" }
  );

  res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

export default router;
