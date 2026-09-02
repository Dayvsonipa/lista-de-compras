import { neon } from "@neondatabase/serverless";

function connectionString() {
  const value = process.env.DATABASE_URL;
  if (!value) {
    throw new Error("DATABASE_URL não foi configurada.");
  }
  return value;
}

export function db() {
  return neon(connectionString());
}
