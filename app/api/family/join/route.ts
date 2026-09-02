import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return Response.json({ error: "Faça login novamente." }, { status: 401 });
    if (user.familyId) return Response.json({ error: "Você já participa de uma família." }, { status: 409 });

    const body = (await request.json()) as { code?: string };
    const code = typeof body.code === "string"
      ? body.code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8)
      : "";

    if (code.length !== 8) {
      return Response.json({ error: "Digite o código de 8 caracteres." }, { status: 400 });
    }

    const sql = db();
    const rows = await sql`
      INSERT INTO family_members (family_id, user_id, role)
      SELECT fi.family_id, ${user.id}, 'member'
      FROM family_invites fi
      WHERE fi.code = ${code}
        AND fi.expires_at > NOW()
      ON CONFLICT (user_id) DO NOTHING
      RETURNING family_id
    `;

    if (rows.length === 0) {
      return Response.json({ error: "Código inválido ou vencido." }, { status: 404 });
    }

    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Não foi possível entrar na família." }, { status: 500 });
  }
}
