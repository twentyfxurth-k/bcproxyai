import { NextRequest, NextResponse } from "next/server";
import { getSqlClient } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const NAME_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

/**
 * GET /v1/prompts — list all saved prompts
 * POST /v1/prompts — create/replace prompt  { name, content, description? }
 */
export async function GET() {
  try {
    const sql = getSqlClient();
    const rows = await sql<Array<Record<string, unknown>>>`
      SELECT name, description, use_count, created_at, updated_at,
             length(content) AS content_length
      FROM prompts
      ORDER BY updated_at DESC
    `;
    return NextResponse.json({ total: rows.length, prompts: rows }, {
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    return NextResponse.json({ error: { message: String(err) } }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, content, description } = body as {
      name?: string; content?: string; description?: string;
    };
    if (!name || !NAME_RE.test(name)) {
      return NextResponse.json(
        { error: { message: "name required (letters/digits/-/_, max 64 chars)" } },
        { status: 400 }
      );
    }
    if (!content || typeof content !== "string" || content.length === 0) {
      return NextResponse.json(
        { error: { message: "content required (non-empty string)" } },
        { status: 400 }
      );
    }
    if (content.length > 50_000) {
      return NextResponse.json(
        { error: { message: "content too long (max 50,000 chars)" } },
        { status: 400 }
      );
    }

    const sql = getSqlClient();
    await sql`
      INSERT INTO prompts (name, content, description)
      VALUES (${name}, ${content}, ${description ?? null})
      ON CONFLICT (name) DO UPDATE SET
        content = EXCLUDED.content,
        description = EXCLUDED.description,
        updated_at = now()
    `;
    return NextResponse.json({ ok: true, name }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: { message: String(err) } }, { status: 500 });
  }
}
