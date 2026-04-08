import { getSqlClient } from "./client";

let migrationDone = false;

export async function runMigrations(): Promise<void> {
  if (migrationDone) return;
  migrationDone = true;

  const sql = getSqlClient();

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS models (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        provider TEXT NOT NULL,
        model_id TEXT NOT NULL,
        context_length INTEGER DEFAULT 0,
        tier TEXT DEFAULT 'small',
        description TEXT,
        supports_tools INTEGER DEFAULT -1,
        supports_vision INTEGER DEFAULT -1,
        nickname TEXT,
        supports_audio_input INTEGER DEFAULT 0,
        supports_audio_output INTEGER DEFAULT 0,
        supports_image_gen INTEGER DEFAULT 0,
        supports_embedding INTEGER DEFAULT 0,
        supports_json_mode INTEGER DEFAULT 0,
        supports_reasoning INTEGER DEFAULT 0,
        supports_code INTEGER DEFAULT 0,
        max_output_tokens INTEGER DEFAULT 0,
        pricing_input REAL DEFAULT 0,
        pricing_output REAL DEFAULT 0,
        first_seen TIMESTAMPTZ DEFAULT now(),
        last_seen TIMESTAMPTZ DEFAULT now()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS health_logs (
        id BIGSERIAL PRIMARY KEY,
        model_id TEXT NOT NULL REFERENCES models(id) ON DELETE CASCADE,
        status TEXT NOT NULL,
        latency_ms INTEGER DEFAULT 0,
        error TEXT,
        checked_at TIMESTAMPTZ DEFAULT now(),
        cooldown_until TIMESTAMPTZ
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_health_model ON health_logs(model_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_health_checked ON health_logs(checked_at)`;

    await sql`
      CREATE TABLE IF NOT EXISTS benchmark_results (
        id BIGSERIAL PRIMARY KEY,
        model_id TEXT NOT NULL REFERENCES models(id) ON DELETE CASCADE,
        category TEXT DEFAULT 'general',
        question TEXT NOT NULL,
        answer TEXT,
        score REAL DEFAULT 0,
        max_score REAL DEFAULT 10,
        reasoning TEXT,
        latency_ms INTEGER DEFAULT 0,
        tested_at TIMESTAMPTZ DEFAULT now()
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_benchmark_model ON benchmark_results(model_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_benchmark_category ON benchmark_results(category)`;

    await sql`
      CREATE TABLE IF NOT EXISTS worker_logs (
        id BIGSERIAL PRIMARY KEY,
        step TEXT NOT NULL,
        message TEXT NOT NULL,
        level TEXT DEFAULT 'info',
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_worker_logs_created ON worker_logs(created_at)`;

    await sql`
      CREATE TABLE IF NOT EXISTS worker_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS gateway_logs (
        id BIGSERIAL PRIMARY KEY,
        request_model TEXT NOT NULL,
        resolved_model TEXT,
        provider TEXT,
        status INTEGER DEFAULT 0,
        latency_ms INTEGER DEFAULT 0,
        input_tokens INTEGER DEFAULT 0,
        output_tokens INTEGER DEFAULT 0,
        error TEXT,
        user_message TEXT,
        assistant_message TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_gateway_logs_created ON gateway_logs(created_at)`;

    await sql`
      CREATE TABLE IF NOT EXISTS budget_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS token_usage (
        id BIGSERIAL PRIMARY KEY,
        provider TEXT NOT NULL,
        model_id TEXT NOT NULL,
        input_tokens INTEGER DEFAULT 0,
        output_tokens INTEGER DEFAULT 0,
        estimated_cost_usd REAL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_token_usage_date ON token_usage(created_at)`;

    await sql`
      CREATE TABLE IF NOT EXISTS complaints (
        id BIGSERIAL PRIMARY KEY,
        model_id TEXT NOT NULL REFERENCES models(id) ON DELETE CASCADE,
        category TEXT NOT NULL,
        reason TEXT,
        user_message TEXT,
        assistant_message TEXT,
        source TEXT DEFAULT 'api',
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_complaints_model ON complaints(model_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_complaints_created ON complaints(created_at)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status)`;

    await sql`
      CREATE TABLE IF NOT EXISTS complaint_exams (
        id BIGSERIAL PRIMARY KEY,
        complaint_id INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
        model_id TEXT NOT NULL REFERENCES models(id) ON DELETE CASCADE,
        question TEXT NOT NULL,
        answer TEXT,
        score REAL DEFAULT 0,
        max_score REAL DEFAULT 10,
        reasoning TEXT,
        latency_ms INTEGER DEFAULT 0,
        passed INTEGER DEFAULT 0,
        tested_at TIMESTAMPTZ DEFAULT now()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS routing_stats (
        id BIGSERIAL PRIMARY KEY,
        model_id TEXT NOT NULL REFERENCES models(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        prompt_category TEXT NOT NULL DEFAULT 'general',
        success INTEGER DEFAULT 1,
        latency_ms INTEGER DEFAULT 0,
        complaint_after INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_routing_stats_cat ON routing_stats(prompt_category, provider)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_routing_stats_model ON routing_stats(model_id)`;

    await sql`
      CREATE TABLE IF NOT EXISTS events (
        id BIGSERIAL PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        detail TEXT,
        provider TEXT,
        model_id TEXT,
        severity TEXT DEFAULT 'info',
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at)`;

    await sql`
      CREATE TABLE IF NOT EXISTS api_keys (
        provider TEXT PRIMARY KEY,
        api_key TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `;

    console.log("[migrate] All tables created/verified");
  } catch (err) {
    console.error("[migrate] Migration failed:", err);
    throw err;
  }
}
