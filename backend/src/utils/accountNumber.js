export function generateAccountNumber() {
  return String(Date.now()).slice(-10);
}
