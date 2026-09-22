import { useEffect, useState } from "react";
import { api } from "./api";

const money = (value) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES" }).format(value || 0);

function Auth({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      const result = mode === "login"
        ? await api.login({ email: form.email, password: form.password })
        : await api.register(form);

      localStorage.setItem("token", result.token);
      localStorage.setItem("user", JSON.stringify(result.user));
      onLogin(result.user);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1>Banking System</h1>
        <p className="muted">{mode === "login" ? "Sign in to continue" : "Create your banking profile"}</p>
        <form onSubmit={submit}>
          {mode === "register" && (
            <input placeholder="Full name" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })} />
          )}
          <input type="email" placeholder="Email" value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })} required />
          <input type="password" placeholder="Password" value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })} required />
          {error && <div className="error">{error}</div>}
          <button>{mode === "login" ? "Login" : "Register"}</button>
        </form>
        <button className="secondary" onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "Create account" : "Already registered? Login"}
        </button>
      </div>
    </main>
  );
}

function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("user") || "null"));
  const [accounts, setAccounts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState("");

  async function refresh() {
    try {
      const data = await api.accounts();
      setAccounts(data);
      if (selected) {
        setSelected(data.find(a => a.id === selected.id) || null);
      }
    } catch (err) {
      setMessage(err.message);
    }
  }

  useEffect(() => {
    if (user) refresh();
  }, [user]);

  if (!user) return <Auth onLogin={setUser} />;

  function logout() {
    localStorage.clear();
    setUser(null);
  }

  async function run(action) {
    try {
      await action();
      await refresh();
      setMessage("Transaction completed successfully.");
    } catch (err) {
      setMessage(err.message);
    }
  }

  const total = accounts.reduce((sum, a) => sum + a.balance, 0);

  return (
    <div>
      <header className="topbar">
        <div>
          <strong>Banking Transaction System</strong>
          <span className="muted-light">Welcome, {user.name}</span>
        </div>
        <button className="logout" onClick={logout}>Logout</button>
      </header>

      <main className="container">
        {message && <div className="notice">{message}</div>}

        <section className="stats">
          <div><span>Accounts</span><strong>{accounts.length}</strong></div>
          <div><span>Total balance</span><strong>{money(total)}</strong></div>
          <div><span>Active loans</span><strong>{accounts.filter(a => a.loan).length}</strong></div>
        </section>

        <section className="grid">
          <CreateAccount onDone={() => run(async () => {})} refresh={refresh} setMessage={setMessage} />
          <TransactionForm title="Deposit" accounts={accounts} action={(id, amount) => run(() => api.deposit(id, amount))} />
          <TransactionForm title="Withdraw" accounts={accounts} action={(id, amount) => run(() => api.withdraw(id, amount))} />
          <TransferForm accounts={accounts} onDone={(from, to, amount) => run(() => api.transfer(from, to, amount))} />
          <LoanCard accounts={accounts} onLoan={id => run(() => api.loan(id))} />
          <DeleteCard accounts={accounts} onDelete={id => run(() => api.deleteAccount(id))} />
        </section>

        <section className="accounts">
          <div className="section-title">
            <h2>Your accounts</h2>
            <span>{accounts.length} account(s)</span>
          </div>
          {accounts.length === 0 ? (
            <p className="muted">No accounts yet. Create your first bank account above.</p>
          ) : accounts.map(account => (
            <AccountCard
              key={account.id}
              account={account}
              selected={selected?.id === account.id}
              onSelect={() => setSelected(selected?.id === account.id ? null : account)}
            />
          ))}
        </section>

        {selected && <TransactionHistory account={selected} />}
      </main>
    </div>
  );
}

function CreateAccount({ refresh, setMessage }) {
  const [deposit, setDeposit] = useState("");

  async function submit(e) {
    e.preventDefault();
    try {
      const account = await api.createAccount(Number(deposit || 0));
      setDeposit("");
      await refresh();
      setMessage(`Account ${account.account_number} created.`);
    } catch (err) {
      setMessage(err.message);
    }
  }

  return (
    <Card title="Create bank account">
      <form onSubmit={submit}>
        <input type="number" min="0" placeholder="Initial deposit (KES)"
          value={deposit} onChange={e => setDeposit(e.target.value)} />
        <button>Create account</button>
      </form>
    </Card>
  );
}

function TransactionForm({ title, accounts, action }) {
  const [id, setId] = useState("");
  const [amount, setAmount] = useState("");

  async function submit(e) {
    e.preventDefault();
    await action(Number(id), Number(amount));
    setAmount("");
  }

  return (
    <Card title={title}>
      <form onSubmit={submit}>
        <select value={id} onChange={e => setId(e.target.value)} required>
          <option value="">Select account</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.account_number}</option>)}
        </select>
        <input type="number" min="1" placeholder="Amount (KES)"
          value={amount} onChange={e => setAmount(e.target.value)} required />
        <button>{title}</button>
      </form>
    </Card>
  );
}

function TransferForm({ accounts, onDone }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");

  async function submit(e) {
    e.preventDefault();
    await onDone(Number(from), Number(to), Number(amount));
    setAmount("");
  }

  return (
    <Card title="Transfer funds">
      <form onSubmit={submit}>
        <select value={from} onChange={e => setFrom(e.target.value)} required>
          <option value="">From account</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.account_number}</option>)}
        </select>
        <select value={to} onChange={e => setTo(e.target.value)} required>
          <option value="">To account</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.account_number}</option>)}
        </select>
        <input type="number" min="1" placeholder="Amount (KES)"
          value={amount} onChange={e => setAmount(e.target.value)} required />
        <button>Transfer</button>
      </form>
    </Card>
  );
}

function LoanCard({ accounts, onLoan }) {
  const [id, setId] = useState("");
  return (
    <Card title="Bonus: KES 10,000 loan">
      <select value={id} onChange={e => setId(e.target.value)}>
        <option value="">Select account</option>
        {accounts.map(a => <option key={a.id} value={a.id}>{a.account_number}</option>)}
      </select>
      <button className="success" disabled={!id} onClick={() => onLoan(Number(id))}>
        Create loan & disburse KES 10,000
      </button>
    </Card>
  );
}

function DeleteCard({ accounts, onDelete }) {
  const dormant = accounts.filter(a => a.status === "DORMANT" && a.balance === 0);
  const [id, setId] = useState("");
  return (
    <Card title="Delete dormant account">
      <select value={id} onChange={e => setId(e.target.value)}>
        <option value="">Select zero-balance account</option>
        {dormant.map(a => <option key={a.id} value={a.id}>{a.account_number}</option>)}
      </select>
      <button className="danger" disabled={!id} onClick={() => onDelete(Number(id))}>
        Delete account
      </button>
    </Card>
  );
}

function AccountCard({ account, selected, onSelect }) {
  return (
    <div className={`account ${selected ? "selected" : ""}`} onClick={onSelect}>
      <div>
        <strong>{account.account_number}</strong>
        <span>{account.status}</span>
      </div>
      <div>
        <small>Balance</small>
        <h3>{money(account.balance)}</h3>
      </div>
    </div>
  );
}

function TransactionHistory({ account }) {
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    api.transactions(account.id).then(setTransactions).catch(() => {});
  }, [account.id]);

  return (
    <section className="accounts">
      <div className="section-title">
        <h2>Transaction history</h2>
        <span>{account.account_number}</span>
      </div>
      {transactions.length === 0 ? <p className="muted">No transactions yet.</p> :
        transactions.map(t => (
          <div className="transaction" key={t.id}>
            <span><strong>{t.type}</strong><small>{t.created_at}</small></span>
            <strong>{money(t.amount)}</strong>
          </div>
        ))
      }
    </section>
  );
}

function Card({ title, children }) {
  return <section className="card"><h2>{title}</h2>{children}</section>;
}

export default App;
