import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return Response.json(
        { error: "Faça login novamente." },
        { status: 401 }
      );
    }

    if (!user.familyId) {
      return Response.json(
        { error: "Entre em uma família primeiro." },
        { status: 403 }
      );
    }

    const body = (await request.json()) as {
      sessionId?: string;
      itemIds?: string[];
    };

    if (
      typeof body.sessionId !== "string" ||
      !UUID_PATTERN.test(body.sessionId)
    ) {
      return Response.json(
        { error: "Compra inválida." },
        { status: 400 }
      );
    }

    const itemIds = Array.isArray(body.itemIds)
      ? [
          ...new Set(
            body.itemIds.filter(
              (id) => typeof id === "string" && UUID_PATTERN.test(id)
            )
          ),
        ].slice(0, 300)
      : [];

    if (itemIds.length === 0) {
      return Response.json({ ok: true, archived: 0 });
    }

    const sql = db();

    const result = await sql`SELECT archive_measured_purchase(${user.familyId}::uuid, ${user.id}::uuid, ${body.sessionId}::uuid, ${itemIds}::uuid[]) AS archived`;
    return Response.json({ ok: true, archived: Number(result[0].archived) });

  } catch (error) {
    const detalhe = error as {
      message?: string;
      code?: string;
      table?: string;
      column?: string;
      constraint?: string;
    };

    console.error("Erro ao finalizar compra:", {
      mensagem: detalhe?.message,
      codigo: detalhe?.code,
      tabela: detalhe?.table,
      coluna: detalhe?.column,
      restricao: detalhe?.constraint,
    });

    return Response.json(
      { error: "Não foi possível arquivar esta compra." },
      { status: 500 }
    );
  }
}