import express from "express";
import db from "../../database.js";
import { auth } from "../middleware/auth.js";
import { generateAccountNumber } from "../utils/accountNumber.js";

const router = express.Router();
router.use(auth);

function getOwnedAccount(userId, accountId) {
  return db.prepare("SELECT * FROM accounts WHERE id = ? AND user_id = ?").get(accountId, userId);
}

router.get("/", (req, res) => {
  const accounts = db.prepare("SELECT * FROM accounts WHERE user_id = ? ORDER BY id DESC").all(req.user.id);
  res.json(accounts);
});

router.post("/", (req, res) => {
  const { initialDeposit = 0 } = req.body;
  const deposit = Number(initialDeposit);

  if (!Number.isFinite(deposit) || deposit < 0) {
    return res.status(400).json({ message: "Initial deposit must be zero or greater" });
  }

  let accountNumber = generateAccountNumber();
  while (db.prepare("SELECT id FROM accounts WHERE account_number = ?").get(accountNumber)) {
    accountNumber = generateAccountNumber() + Math.floor(Math.random() * 9);
  }

  const create = db.transaction(() => {
    const result = db.prepare(
      "INSERT INTO accounts (user_id, account_number, balance, status) VALUES (?, ?, ?, ?)"
    ).run(req.user.id, accountNumber, deposit, deposit === 0 ? "DORMANT" : "ACTIVE");

    if (deposit > 0) {
      db.prepare(
        "INSERT INTO transactions (account_id, type, amount, description) VALUES (?, 'DEPOSIT', ?, 'Initial deposit')"
      ).run(result.lastInsertRowid, deposit);
    }

    return result.lastInsertRowid;
  });

  const id = create();
  res.status(201).json(db.prepare("SELECT * FROM accounts WHERE id = ?").get(id));
});

router.post("/:id/deposit", (req, res) => {
  const amount = Number(req.body.amount);
  const account = getOwnedAccount(req.user.id, req.params.id);

  if (!account) return res.status(404).json({ message: "Account not found" });
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: "Amount must be greater than zero" });

  const run = db.transaction(() => {
    db.prepare("UPDATE accounts SET balance = balance + ?, status = 'ACTIVE' WHERE id = ?").run(amount, account.id);
    db.prepare("INSERT INTO transactions (account_id, type, amount, description) VALUES (?, 'DEPOSIT', ?, 'Cash deposit')").run(account.id, amount);
  });
  run();

  res.json({ message: "Deposit successful" });
});

router.post("/:id/withdraw", (req, res) => {
  const amount = Number(req.body.amount);
  const account = getOwnedAccount(req.user.id, req.params.id);

  if (!account) return res.status(404).json({ message: "Account not found" });
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: "Amount must be greater than zero" });
  if (account.balance < amount) return res.status(400).json({ message: "Insufficient funds" });

  const run = db.transaction(() => {
    const newBalance = account.balance - amount;
    db.prepare("UPDATE accounts SET balance = ?, status = ? WHERE id = ?")
      .run(newBalance, newBalance === 0 ? "DORMANT" : "ACTIVE", account.id);
    db.prepare("INSERT INTO transactions (account_id, type, amount, description) VALUES (?, 'WITHDRAWAL', ?, 'Cash withdrawal')").run(account.id, amount);
  });
  run();

  res.json({ message: "Withdrawal successful" });
});

router.post("/transfer", (req, res) => {
  const { fromAccountId, toAccountId } = req.body;
  const amount = Number(req.body.amount);

  if (fromAccountId === toAccountId) return res.status(400).json({ message: "Source and destination must be different" });
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: "Amount must be greater than zero" });

  const from = getOwnedAccount(req.user.id, fromAccountId);
  const to = getOwnedAccount(req.user.id, toAccountId);

  if (!from || !to) return res.status(404).json({ message: "One or both accounts not found" });
  if (from.balance < amount) return res.status(400).json({ message: "Insufficient funds" });

  const run = db.transaction(() => {
    const sourceBalance = from.balance - amount;
    db.prepare("UPDATE accounts SET balance = ?, status = ? WHERE id = ?")
      .run(sourceBalance, sourceBalance === 0 ? "DORMANT" : "ACTIVE", from.id);

    db.prepare("UPDATE accounts SET balance = balance + ?, status = 'ACTIVE' WHERE id = ?").run(amount, to.id);

    db.prepare("INSERT INTO transactions (account_id, type, amount, reference_account, description) VALUES (?, 'TRANSFER_OUT', ?, ?, 'Transfer sent')")
      .run(from.id, amount, to.account_number);

    db.prepare("INSERT INTO transactions (account_id, type, amount, reference_account, description) VALUES (?, 'TRANSFER_IN', ?, ?, 'Transfer received')")
      .run(to.id, amount, from.account_number);
  });
  run();

  res.json({ message: "Transfer successful" });
});

router.delete("/:id", (req, res) => {
  const account = getOwnedAccount(req.user.id, req.params.id);

  if (!account) return res.status(404).json({ message: "Account not found" });
  if (account.balance !== 0 || account.status !== "DORMANT") {
    return res.status(400).json({ message: "Only dormant accounts with a zero balance can be deleted" });
  }

  db.prepare("DELETE FROM accounts WHERE id = ?").run(account.id);
  res.json({ message: "Dormant account deleted" });
});

router.post("/:id/loan", (req, res) => {
  const account = getOwnedAccount(req.user.id, req.params.id);
  if (!account) return res.status(404).json({ message: "Account not found" });

  const existing = db.prepare("SELECT id FROM loans WHERE account_id = ? AND status = 'ACTIVE'").get(account.id);
  if (existing) return res.status(409).json({ message: "Account already has an active loan" });

  const amount = 10000;

  const run = db.transaction(() => {
    db.prepare("INSERT INTO loans (account_id, principal, outstanding) VALUES (?, ?, ?)").run(account.id, amount, amount);
    db.prepare("UPDATE accounts SET balance = balance + ?, status = 'ACTIVE' WHERE id = ?").run(amount, account.id);
    db.prepare("INSERT INTO transactions (account_id, type, amount, description) VALUES (?, 'LOAN_DISBURSEMENT', ?, 'KES 10,000 starter loan')")
      .run(account.id, amount);
  });
  run();

  res.json({ message: "KES 10,000 loan disbursed successfully" });
});

router.get("/:id/transactions", (req, res) => {
  const account = getOwnedAccount(req.user.id, req.params.id);
  if (!account) return res.status(404).json({ message: "Account not found" });

  const transactions = db.prepare(
    "SELECT * FROM transactions WHERE account_id = ? ORDER BY id DESC"
  ).all(account.id);

  res.json(transactions);
});

router.get("/:id/loan", (req, res) => {
  const account = getOwnedAccount(req.user.id, req.params.id);
  if (!account) return res.status(404).json({ message: "Account not found" });

  const loan = db.prepare(
    "SELECT * FROM loans WHERE account_id = ? ORDER BY id DESC LIMIT 1"
  ).get(account.id);

  res.json(loan || null);
});

export default router;
