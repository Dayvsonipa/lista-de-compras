export function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

export function normalizeProductName(value: unknown) {
  return cleanText(value, 120)
    .toLocaleLowerCase("pt-BR")
    .replace(/(\d)\s*(kg|g|ml|l)\b/g, "$1 $2");
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

export function isValidPassword(password: unknown) {
  return typeof password === "string" && password.length >= 8 && password.length <= 128;
}
