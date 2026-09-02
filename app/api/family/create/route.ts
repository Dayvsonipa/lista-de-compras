import { randomUUID } from "node:crypto";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createInviteCode } from "@/lib/invites";
import { cleanText } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return Response.json({ error: "Faça login novamente." }, { status: 401 });
    if (user.familyId) return Response.json({ error: "Você já participa de uma família." }, { status: 409 });

    const body = (await request.json()) as { name?: string };
    const name = cleanText(body.name, 100);
    if (name.length < 2) {
      return Response.json({ error: "Informe o nome da família." }, { status: 400 });
    }

    const familyId = randomUUID();
    const inviteId = randomUUID();
    const inviteCode = createInviteCode();
    const sql = db();

    await sql`
      WITH created_family AS (
        INSERT INTO families (id, name, created_by)
        VALUES (${familyId}, ${name}, ${user.id})
        RETURNING id
      ),
      created_member AS (
        INSERT INTO family_members (family_id, user_id, role)
        SELECT id, ${user.id}, 'owner'
        FROM created_family
        RETURNING family_id
      )
      INSERT INTO family_invites (id, family_id, code, created_by, expires_at)
      SELECT ${inviteId}, family_id, ${inviteCode}, ${user.id}, NOW() + INTERVAL '1 year'
      FROM created_member
    `;

    return Response.json({ ok: true, inviteCode });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "23505") {
      return Response.json({ error: "Não foi possível criar. Tente novamente." }, { status: 409 });
    }
    return Response.json({ error: "Não foi possível criar a família." }, { status: 500 });
  }
}
