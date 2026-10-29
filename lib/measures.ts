export const units = ["item", "un", "kg", "g", "l", "ml", "pacote", "caixa", "maço", "pé", "cabeça", "bandeja", "vidro", "sachê", "pote", "copo", "lata"] as const;
export type Unit = typeof units[number];
export function validUnit(value: unknown): value is Unit { return typeof value === "string" && units.includes(value as Unit); }
export function baseUnit(unit: string = "un") { return unit === "g" ? "kg" : unit === "ml" ? "l" : unit; }
export function baseQuantity(quantity: string | number, unit: string = "un") {
  return Number(String(quantity).replace(",", ".")) / (unit === "g" || unit === "ml" ? 1000 : 1);
}
export function parseQuantity(value: unknown, unit: string = "un"): string | null {
  const raw = String(value ?? "1").trim().replace(",", ".");
  if (!/^\d{1,4}(?:\.\d{1,3})?$/.test(raw)) return null;
  const n = Number(raw);
  if (n <= 0 || n > 9999 || (!["kg", "g", "l", "ml"].includes(unit) && !Number.isInteger(n))) return null;
  return String(n);
}
export function measuredTotal(price: number, quantity: string, unit: string = "un", basis?: string | null) {
  const amount = basis ? baseQuantity(quantity, unit) : Number(quantity);
  return Math.round((price * amount + Number.EPSILON) * 100) / 100;
}
export function quantityLabel(quantity: string, unit: string = "un") { return unit === "item" ? `${quantity.replace(".", ",")} ×` : `${quantity.replace(".", ",")} ${unit}`; }
export function needsProductChoice(name: string) { return /\s+ou\s+/i.test(name) || /^sal e temperos$/i.test(name.trim()); }
