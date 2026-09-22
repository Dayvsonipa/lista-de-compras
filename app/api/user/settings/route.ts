import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isAppLanguage } from "@/lib/i18n";

export async function PATCH(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return Response.json({ error: "Faça login novamente." }, { status: 401 });

    const body = (await request.json()) as { preferredLanguage?: unknown };
    if (!isAppLanguage(body.preferredLanguage)) {
      return Response.json({ error: "Idioma inválido." }, { status: 400 });
    }

    const sql = db();
    await sql`
      UPDATE users
      SET preferred_language = ${body.preferredLanguage}
      WHERE id = ${user.id}
    `;

    return Response.json({ ok: true, preferredLanguage: body.preferredLanguage });
  } catch {
    return Response.json({ error: "Não foi possível salvar o idioma." }, { status: 500 });
  }
}
