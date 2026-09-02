import { randomUUID } from "node:crypto";
import { createSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { cleanText, isValidEmail, isValidPassword, normalizeEmail } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { name?: string; email?: string; password?: string };
    const name = cleanText(body.name, 100);
    const email = normalizeEmail(body.email);

    if (name.length < 2) {
      return Response.json({ error: "Informe seu nome." }, { status: 400 });
    }
    if (!isValidEmail(email)) {
      return Response.json({ error: "Informe um e-mail válido." }, { status: 400 });
    }
    if (!isValidPassword(body.password)) {
      return Response.json({ error: "A senha precisa ter pelo menos 8 caracteres." }, { status: 400 });
    }

    const userId = randomUUID();
    const sql = db();
    await sql`
      INSERT INTO users (id, name, email, password_hash)
      VALUES (${userId}, ${name}, ${email}, ${hashPassword(body.password!)})
    `;

    await createSession(userId);
    return Response.json({ ok: true, redirectTo: "/familia" }, { status: 201 });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "23505") {
      return Response.json({ error: "Já existe uma conta com este e-mail." }, { status: 409 });
    }
    return Response.json({ error: "Não foi possível criar sua conta." }, { status: 500 });
  }
}
