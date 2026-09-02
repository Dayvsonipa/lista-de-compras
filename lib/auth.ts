import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";

const COOKIE_NAME = "lista_de_casa_session";
const SESSION_DAYS = 30;

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  familyId: string | null;
  familyName: string | null;
  role: "owner" | "member" | null;
  inviteCode: string | null;
};

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const hash = tokenHash(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const sql = db();

  await sql`
    INSERT INTO sessions (token_hash, user_id, expires_at)
    VALUES (${hash}, ${userId}, ${expiresAt.toISOString()})
  `;

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (token) {
    const sql = db();
    await sql`DELETE FROM sessions WHERE token_hash = ${tokenHash(token)}`;
  }

  cookieStore.delete(COOKIE_NAME);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const sql = db();
  const rows = await sql`
    SELECT
      u.id,
      u.name,
      u.email,
      fm.family_id,
      f.name AS family_name,
      fm.role,
      (
        SELECT fi.code
        FROM family_invites fi
        WHERE fi.family_id = fm.family_id
          AND fi.expires_at > NOW()
        ORDER BY fi.created_at DESC
        LIMIT 1
      ) AS invite_code
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN family_members fm ON fm.user_id = u.id
    LEFT JOIN families f ON f.id = fm.family_id
    WHERE s.token_hash = ${tokenHash(token)}
      AND s.expires_at > NOW()
    LIMIT 1
  `;

  if (rows.length === 0) return null;
  const row = rows[0];

  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    familyId: row.family_id ? String(row.family_id) : null,
    familyName: row.family_name ? String(row.family_name) : null,
    role: row.role === "owner" || row.role === "member" ? row.role : null,
    inviteCode: row.invite_code ? String(row.invite_code) : null,
  };
}
