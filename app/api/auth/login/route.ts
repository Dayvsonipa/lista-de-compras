import { createSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { isValidEmail, normalizeEmail } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const email = normalizeEmail(body.email);

    if (!isValidEmail(email) || typeof body.password !== "string") {
      return Response.json({ error: "E-mail ou senha incorretos." }, { status: 401 });
    }

    const sql = db();
    const rows = await sql`
      SELECT id, password_hash
      FROM users
      WHERE email = ${email}
      LIMIT 1
    `;

    if (rows.length === 0 || !verifyPassword(body.password, String(rows[0].password_hash))) {
      return Response.json({ error: "E-mail ou senha incorretos." }, { status: 401 });
    }

    await createSession(String(rows[0].id));
    return Response.json({ ok: true, redirectTo: "/" });
  } catch {
    return Response.json({ error: "Não foi possível entrar agora." }, { status: 500 });
  }
}
