import { NextRequest, NextResponse } from "next/server";
import { getSqlClient } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const NAME_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

/**
 * GET    /v1/prompts/:name — fetch full prompt
 * PUT    /v1/prompts/:name — update { content, description? }
 * DELETE /v1/prompts/:name — remove
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    if (!NAME_RE.test(name)) {
      return NextResponse.json({ error: { message: "Invalid name" } }, { status: 400 });
    }
    const sql = getSqlClient();
    const rows = await sql<Array<Record<string, unknown>>>`
      SELECT name, content, description, use_count, created_at, updated_at
      FROM prompts WHERE name = ${name}
    `;
    if (rows.length === 0) {
      return NextResponse.json({ error: { message: "not found" } }, { status: 404 });
    }
    return NextResponse.json(rows[0], {
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    return NextResponse.json({ error: { message: String(err) } }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    if (!NAME_RE.test(name)) {
      return NextResponse.json({ error: { message: "Invalid name" } }, { status: 400 });
    }
    const body = await req.json();
    const { content, description } = body as { content?: string; description?: string };
    if (!content || typeof content !== "string" || content.length === 0) {
      return NextResponse.json({ error: { message: "content required" } }, { status: 400 });
    }
    if (content.length > 50_000) {
      return NextResponse.json({ error: { message: "content too long (max 50,000 chars)" } }, { status: 400 });
    }
    const sql = getSqlClient();
    const rows = await sql<Array<{ name: string }>>`
      UPDATE prompts
      SET content = ${content},
          description = ${description ?? null},
          updated_at = now()
      WHERE name = ${name}
      RETURNING name
    `;
    if (rows.length === 0) {
      return NextResponse.json({ error: { message: "not found" } }, { status: 404 });
    }
    return NextResponse.json({ ok: true, name });
  } catch (err) {
    return NextResponse.json({ error: { message: String(err) } }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    if (!NAME_RE.test(name)) {
      return NextResponse.json({ error: { message: "Invalid name" } }, { status: 400 });
    }
    const sql = getSqlClient();
    const rows = await sql<Array<{ name: string }>>`
      DELETE FROM prompts WHERE name = ${name} RETURNING name
    `;
    if (rows.length === 0) {
      return NextResponse.json({ error: { message: "not found" } }, { status: 404 });
    }
    return NextResponse.json({ ok: true, name });
  } catch (err) {
    return NextResponse.json({ error: { message: String(err) } }, { status: 500 });
  }
}
