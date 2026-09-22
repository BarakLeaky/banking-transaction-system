const API = "http://localhost:5000/api";

async function request(path, options = {}) {
  const token = localStorage.getItem("token");
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Request failed");
  return data;
}

export const api = {
  register: (body) => request("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body) => request("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  accounts: () => request("/accounts"),
  createAccount: (initialDeposit) => request("/accounts", {
    method: "POST", body: JSON.stringify({ initialDeposit })
  }),
  deposit: (id, amount) => request(`/accounts/${id}/deposit`, {
    method: "POST", body: JSON.stringify({ amount })
  }),
  withdraw: (id, amount) => request(`/accounts/${id}/withdraw`, {
    method: "POST", body: JSON.stringify({ amount })
  }),
  transfer: (fromAccountId, toAccountId, amount) => request("/accounts/transfer", {
    method: "POST", body: JSON.stringify({ fromAccountId, toAccountId, amount })
  }),
  deleteAccount: (id) => request(`/accounts/${id}`, { method: "DELETE" }),
  loan: (id) => request(`/accounts/${id}/loan`, { method: "POST" }),
  transactions: (id) => request(`/accounts/${id}/transactions`),
  loanInfo: (id) => request(`/accounts/${id}/loan`)
};
