# BCProxyAI

OpenAI-compatible LLM gateway ที่รวม model ฟรีจากหลาย provider เข้ามาในจุดเดียว —
**ฉลาดขึ้นเองจากการใช้งาน** ไม่ต้องตั้งค่า ไม่ต้องบอกว่า model ไหนดี ยิ่งใช้ยิ่งรู้จัก

---

## ✨ Highlight

- 🎓 **Exam System** — Model ทุกตัวต้องผ่านสอบก่อนได้ทำงาน (rule-based 10 ข้อ, ผ่าน ≥ 70%)
- 🏆 **Category Winners** — เรียนรู้ว่า model ไหนเก่ง thai / code / math / tools / long-context
- 📏 **Self-Learning Rate Limits** — อ่าน `x-ratelimit-*` + parse 429 message เรียนรู้ TPM/TPD เอง
- 📐 **Capacity Learning** — p90 ของ token size ที่ model ทำได้จริง
- ⏳ **Exponential Cooldown** — 30s → 1m → 2 → 4 → 8 min cap, reset อัตโนมัติ
- ⚡ **Live Score EMA** — success rate อัพเดททุก request ไม่ต้องรอ benchmark
- 🔄 **Adaptive Exam Retry** — สอบใหม่บ่อยตาม production performance (1h – 7 วัน)
- 🌐 **13 Providers** — OpenRouter, Groq, Cerebras, Mistral, Ollama และอื่นๆ
- 📊 **Full Observability** — Request ID trace ทั้ง chain, dashboard UI

---

## 🏗 Architecture

```
┌──────────────┐     3333      ┌───────────┐        ┌──────────────┐
│ OpenAI SDK / ├──────────────▶│ Caddy     │───────▶│ bcproxyai    │
│ น้องกุ้ง /    │    :3334      │ (proxy)   │        │ Next.js 16   │
│ OpenClaw     │               └───────────┘        └──────┬───────┘
└──────────────┘                                           │
                                                           ▼
                 ┌─────────────────────────────────────────┴─────────────────┐
                 │                 Smart Routing Engine                       │
                 │                                                             │
                 │  1. Filter: enabled + hasKey + passed_exam + not cooldown  │
                 │  2. Category detect → boost winners                         │
                 │  3. Rank: live_success × 100k + bench × 1k − latency       │
                 │  4. Hedge race top-2 cloud                                  │
                 │  5. Fail → exponential cooldown → next candidate           │
                 └──┬──────────┬──────────┬──────────┬──────────┬─────────────┘
                    ▼          ▼          ▼          ▼          ▼
                 ┌─────┐  ┌─────────┐  ┌────────┐  ┌──────┐  ┌────────┐
                 │Groq │  │Cerebras │  │Mistral │  │Ollama│  │13 more │
                 └─────┘  └─────────┘  └────────┘  └──────┘  └────────┘

                          ┌──────────────┬──────────────┐
                          ▼              ▼              ▼
                    ┌──────────┐   ┌──────────┐   ┌──────────┐
                    │PostgreSQL│   │  Valkey  │   │  Caddy   │
                    │   :5434  │   │   :6382  │   │   :3334  │
                    └──────────┘   └──────────┘   └──────────┘
```

---

## 📦 Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router) |
| Runtime | Node.js + TypeScript 5 |
| UI | React 19 + Tailwind v4 |
| Database | PostgreSQL 17 (driver: `postgres`) |
| Cache/State | Valkey 8 (Redis-compatible) |
| Reverse Proxy | Caddy 2 |
| Scheduler | node-cron |
| Testing | Vitest |
| Load Testing | k6 |

---

## 🚢 Services (docker-compose)

| Container | Role | Host Port |
|---|---|---|
| `bcproxyai` | Next.js app (scalable) | internal `:3000` |
| `caddy` | In-compose reverse proxy / load balancer | **`:3334`** |
| `postgres` | PostgreSQL 17 | `:5434` |
| `redis` | Valkey 8 | `:6382` |

### Port Map

| Port | Service | หมายเหตุ |
|---|---|---|
| **3333** | BCProxyAI via **external** Caddy | timeout 300s, production |
| **3334** | BCProxyAI via **in-compose** Caddy | scaling, load balanced |
| 5434 | PostgreSQL (host) | |
| 6382 | Valkey (host) | |

---

## 🚀 Quick Start

### 1. Clone + ติดตั้ง API Keys

```bash
cp .env.example .env.local
# แก้ .env.local ใส่ API keys อย่างน้อย 1 provider
```

**Providers ที่รองรับ (ฟรีหมด):**

| Provider | ENV var | ลิงก์สมัคร |
|---|---|---|
| OpenRouter | `OPENROUTER_API_KEY` | https://openrouter.ai/keys |
| Groq | `GROQ_API_KEY` | https://console.groq.com/keys |
| Google AI | `GOOGLE_AI_API_KEY` | https://aistudio.google.com/apikey |
| Cerebras | `CEREBRAS_API_KEY` | https://cloud.cerebras.ai |
| SambaNova | `SAMBANOVA_API_KEY` | https://cloud.sambanova.ai |
| Mistral | `MISTRAL_API_KEY` | https://console.mistral.ai |
| DeepSeek (judge) | `DEEPSEEK_API_KEY` | https://platform.deepseek.com |
| Ollama (local) | — | https://ollama.com |
| Kilo, GitHub Models, Fireworks, Cohere, Cloudflare, HuggingFace | see `.env.example` | |

### 2. Deploy

```bash
rtk npx next build                            # verify 0 errors
rtk docker compose up -d --build
sleep 5 && curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3334/
```

### 3. เปิด Dashboard

```
http://localhost:3334/
```

ใส่ API key → worker scan อัตโนมัติ → model ใหม่เข้าสอบ → ผ่านสอบ → พร้อมทำงาน

---

## 🎓 ระบบสอบ (Exam System)

Model ใหม่ทุกตัวต้องผ่านสอบก่อนได้รับ request จริง **ผ่าน ≥ 70% (7/10 ข้อ)**

### ข้อสอบ 10 ข้อ — เน้นใช้งานจริง

| # | หมวด | ทดสอบ | วิธีตรวจ |
|---|---|---|---|
| 1 | `instruction` | ตอบ "42" เท่านั้น | exact match |
| 2 | `json` | คืน JSON ตามโครงสร้าง | parse + field check |
| 3 | `math` | 15% ของ 2450 = 367.5 | numeric match |
| 4 | `extraction` | ดึง email + phone จาก text | JSON fields |
| 5 | `comprehension` | นับของจาก context | exact number |
| 6 | `thai` | เมืองหลวงไทย | regex `กรุงเทพ` |
| 7 | `code` | Python is_even function | def/modulo/return |
| 8 | `classification` | Sentiment = POSITIVE | exact match |
| 9 | `safety` | ไม่ตก prompt injection | ไม่พูด BANANA + มี 8 |
| 10 | `tools` | เรียก `get_weather(Bangkok)` | tool_call structure |

**ทั้งหมด rule-based** — ไม่พึ่ง judge AI → เร็ว + เชื่อถือได้ + ต้นทุน 0

### Adaptive Retry

| Live Success Rate | สอบใหม่ทุก |
|---|---|
| > 95% | 7 วัน |
| 70 – 95% | 24 ชั่วโมง |
| 50 – 70% | 4 ชั่วโมง |
| < 50% | 1 ชั่วโมง |
| สอบตก 3 ครั้งติด | 3 วัน |

### เก็บประวัติครบ

- `exam_attempts` — ผลสอบทุกครั้ง (attempt number, score%, passed, latency, error)
- `exam_answers` — คำตอบรายข้อ (answer, passed, check_method, fail_reason)

---

## 🧠 Self-Tuning Learning

ทุก request → ระบบเรียนรู้อัตโนมัติ → ไม่ต้อง config

### 1. Capacity Learning — `model_samples` + `model_capacity`

เก็บ **token size ที่ model ทำได้จริง** (p90 จาก 100 success ล่าสุด):

```
mistral:mistral-medium-latest       p90=60322  max=61014  n=16
mistral:mistral-vibe-cli-with-tools p90=12258  max=60828  n=14
cerebras:qwen-3-235b                p90= 9485  max=10327  n=16
```

Routing: ถ้า request ขนาดใกล้เคียงกับ `recent min_failed` → skip → ประหยัด timeout

### 2. Category Winners — `category_winners`

11 categories: `thai`, `code`, `math`, `tools`, `vision`, `long-context`, `medium-context`, `knowledge`, `translate`, `classification`, `general`

```
code         → cerebras:qwen-3-235b    wins=2  (100%)
tools        → mistral:mistral-vibe    wins=12 (86%)
long-context → mistral:mistral-medium  wins=4  (100%)
thai         → mistral:mistral-medium  wins=3  (83%)
```

Request ใหม่ → detect category → boost winners ขึ้นบน

### 3. Provider Rate Limits — `provider_limits`

เรียนรู้จาก **3 แหล่ง**:

1. **Response headers** (`x-ratelimit-limit-tokens`, `x-ratelimit-remaining-tokens`, `x-ratelimit-reset-tokens`)
2. **Error 429 message** — parse `"Limit 100000, Used 91788"`
3. **Persist ลง DB** + Redis cache 5 นาที

```
provider | model              | limit_tpm | limit_tpd | remaining  | source
---------+--------------------+-----------+-----------+------------+--------
groq     | llama-3.1-8b       | 6000      | null      | 5937       | header
groq     | llama-3.3-70b      | 12000     | 100000    | 103 (TPD)  | error-tpd
```

ก่อนยิง → `canFitRequest()` เช็ค remaining → skip ถ้าไม่พอ

### 4. Exponential Cooldown — `model_fail_streak`

```
streak 1 → 30 วินาที
streak 2 → 1 นาที
streak 3 → 2 นาที
streak 4 → 4 นาที
streak 5+ → 8 นาที (cap)
```

- **Auto-reset** ถ้า fail ก่อนหน้าเกิน 10 นาที
- **Success → reset streak = 0** ทันที
- ไม่มี permanent ban

### 5. Live Score EMA — in-memory

```
[PROVIDER-RANK] cerebras(100%/2651ms/n=2) > mistral(70%/n=0) > groq(0%/n=2)
```

- α = 0.25 (ใหม่มีน้ำหนัก 25%)
- อัพเดททุก request — ไม่ต้องรอ batch
- Fail → ดันลง ranking ทันที

---

## 🎯 Smart Routing Pipeline

```
Request → Detect category (thai/code/tools/...)
       → Get candidates (passed_exam + enabled + hasKey + not cooldown)
       → Category boost (winners ขึ้นบน)
       → Filter: hasProviderKey + isProviderEnabled
       → Provider cooldown check (Redis)
       → Size filter (context_length >= required × 1.4)
       → Capacity check (recent failures)
       → Provider limits check (TPM/TPD remaining)
       → TPM hard check (request > limit → skip)
       → Rank by provider score × 100k + bench × 1k − latency
       → Hedge race top-2 cloud (parallel fetch, non-tools only)
       → Fail → Exponential cooldown → next candidate
       → All fail → Relaxed retry (ignore soft filters)
       → All fail → 503 with skip reasons breakdown
```

### Per-attempt Timeout (dynamic)

| Body Size | Timeout |
|---|---|
| < 10K chars | 8s |
| 10K – 20K | 12s |
| 20K – 40K | 20s |
| > 40K | 30s |
| Ollama | 30s |

### Total Retry Budget

| Est Tokens | Budget |
|---|---|
| > 20K | 60s |
| > 10K | 45s |
| > 5K | 30s |
| else | 20s |

---

## 🔌 API Endpoints

### Gateway (OpenAI-compatible)

```
POST /v1/chat/completions       # ยิง request — auto routing
POST /v1/chat/completions       # stream=true → SSE
GET  /v1/models                 # รายการ model ที่ผ่านสอบ
```

### Model Selection

```
model: "bcproxy/auto"           # Smart routing (default)
model: "bcproxy/fast"           # เน้น latency ต่ำ
model: "bcproxy/tools"          # เน้น tool calling
model: "bcproxy/thai"           # เน้นภาษาไทย
model: "bcproxy/consensus"      # ยิง 3 model parallel เลือก consensus
model: "groq/llama-3.1-8b"      # Direct provider routing
```

### Admin / Dashboard

| Endpoint | คำอธิบาย |
|---|---|
| `GET /api/status` | Worker status + stats + recent logs |
| `GET /api/models` | รายการ model ทั้งหมด + exam result + cooldown |
| `GET /api/providers` | Provider status + enabled + model count |
| `GET /api/learning` | Category winners + capacities + fail streaks |
| `GET /api/provider-limits` | TPM/TPD ที่เรียนรู้จากแต่ละ model |
| `GET /api/live-score` | Live EMA score snapshot |
| `GET /api/gateway-logs` | Request history (request ID, status, latency, model) |
| `GET /api/analytics` | Token usage + cost analytics |
| `GET /api/leaderboard` | Top performing models |
| `GET /api/infra` | Infrastructure health (DB, Valkey) |
| `GET /api/uptime` | Uptime per provider |
| `GET /api/trend` | Time-series metrics |
| `POST /api/worker` | Trigger worker cycle manually |
| `POST /api/setup` | Add/remove API key or toggle provider |

---

## 🗃 Database Schema

### Core
- `models` — Model metadata (provider, context_length, capabilities)
- `api_keys` — Runtime-configurable API keys
- `provider_settings` — Enable/disable provider toggle

### Exam System
- `exam_attempts` — Every exam run (attempt_number, score_pct, passed, next_exam_at, consecutive_fails)
- `exam_answers` — Per-question results (answer, passed, check_method, fail_reason)

### Learning
- `model_fail_streak` — Exponential cooldown counter
- `model_capacity` — p90 token capacity per model
- `model_samples` — Ring buffer (500 samples/model) — tokens, latency, success, category
- `category_winners` — Wins/losses per (category, model)
- `provider_limits` — Learned TPM/TPD per provider/model
- `discovered_questions` — Patterns ที่ทำให้ model fail (สำหรับ auto-generate exam)

### Runtime
- `health_logs` — Health check + cooldown_until
- `gateway_logs` — ทุก request (ก่อน/หลัง routing)
- `worker_logs` — Worker cycle logs
- `worker_state` — Key-value state (last_run, judge_model, ...)
- `routing_stats` — Per-category latency/success
- `events` — System events feed
- `token_usage` — Cost tracking per model
- `complaints` / `complaint_exams` — User complaint → auto re-exam

### Views
- `benchmark_results` (VIEW) — Read-only compat mapping จาก exam_answers

---

## 🔍 Observability

Every request gets a **Request ID** — trace ทั้ง chain ได้:

```
[REQ:abc123]            bcproxy/auto | tools=true | msgs=7 | est=9315tok | "..."
[CATEGORY-BOOST:abc123] "tools" → 3 winners: cerebras, mistral-medium, mistral-vibe
[PROVIDER-RANK:abc123]  cerebras(100%/2651ms/n=2) > mistral(70%/n=0) > groq(0%/n=2)
[CANDIDATES:abc123]     12 candidates | top5: cerebras/qwen-3-235b(ctx=131072), ...
[LIMIT-SKIP:abc123]     groq/llama-3.3-70b — TPD: remaining 103 < needed 10021
[RETRY:abc123]          1/10 | cerebras/qwen-3-235b → HTTP 429 | tokens per minute
[LIMIT-LEARN]           cerebras/qwen-3-235b error-generic
[EXPO-COOLDOWN:abc123]  cerebras/qwen-3-235b → 1min
[TIMEOUT-ATTEMPT:abc123] mistral/mistral-medium timeout → 1min
[SKIPS:abc123]          tried=2, skipped=3 — {"tpm-exhausted":2,"limit-exhausted":1}
[RES:abc123]            200 | mistral/mistral-vibe-cli-with-tools | 12918ms
```

---

## ⚙️ Worker Cycle

รันทุก **1 ชั่วโมง** (+ trigger manual ได้):

```
Step 1: Scan     → ดึง model จากทุก provider ที่มี key + enabled
                   ลบ model ที่ provider หายไป
Step 2: Health   → ping ทุก model ด้วย timeout 5s
                   auto-detect non-chat model จาก response
Step 3: Exam     → สอบสูงสุด 15 model/รอบ (concurrency 5)
                   adaptive schedule ตาม next_exam_at
```

### Leader Election

Multi-replica safe — ใช้ Redis leader lock ป้องกัน cycle ซ้ำเมื่อ scale horizontal:

```bash
docker compose up -d --scale bcproxyai=3
```

---

## 🔧 Development

### Commands

```bash
npm run dev            # Next.js dev server
npm run build          # Production build
npm run start          # Production server
npm run lint           # ESLint
npm run test           # Vitest
npm run test:watch     # Vitest watch mode
npm run build:mcp      # Build MCP server
npm run mcp            # Run MCP server
```

### Load Testing (k6)

```bash
npm run loadtest:smoke        # Quick smoke test
npm run loadtest:dashboard    # Dashboard load
npm run loadtest:chat         # Chat endpoint load
npm run loadtest:ratelimit    # Rate limit test
npm run loadtest:stress       # Full stress test
```

### Deploy Checklist

```bash
rtk npx next build                                                           # 0 errors
rtk docker compose up -d --build
sleep 5 && curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3334/   # 200
docker ps --format "{{.Names}}\t{{.Status}}" | grep bcproxyai                # Up (healthy)
```

### Caddy Reload

```bash
powershell -File "C:/Users/jatur/restart-caddy.ps1"
```

---

## 🔗 Integration Examples

### OpenAI SDK (Python)

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:3334/v1",
    api_key="dummy"  # bcproxyai ไม่บังคับ
)

response = client.chat.completions.create(
    model="bcproxy/auto",
    messages=[{"role": "user", "content": "สวัสดีครับ"}]
)
print(response.choices[0].message.content)
```

### OpenClaw (Docker)

```bash
docker exec openclaw-bcproxy-test openclaw onboard \
  --non-interactive --accept-risk \
  --auth-choice custom-api-key \
  --custom-base-url http://host.docker.internal:3333/v1 \
  --custom-model-id auto \
  --custom-api-key dummy \
  --custom-compatibility openai

docker exec openclaw-bcproxy-test openclaw agent --agent main -m "สวัสดี"
```

### cURL

```bash
curl -X POST http://localhost:3334/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "bcproxy/auto",
    "messages": [{"role": "user", "content": "Write Python fibonacci"}]
  }'
```

---

## 📊 Dashboard Features

- **ครูใหญ่** — Worker status + judge model + next run
- **นักเรียนใหม่** — Recently discovered models (checked vs pending)
- **สมุดจดงาน** — Real-time gateway logs with filters
- **ModelGrid** — All models with exam scores, cooldown, capabilities
- **ProviderStatus** — 13 provider cards (active / no_key / error / disabled)
- **InfraPanel** — Postgres · Valkey · Replicas · Rate Limit
- **SchoolBell** — System events feed
- **StatsCards** — Total / Available / Cooldown / Passed / Avg Score
- **SetupModal** — Add/remove API keys, toggle provider on/off

UI เป็นภาษาไทยทั้งหมด

---

## 🎛 Provider Management (UI)

เปิด/ปิด provider ได้ผ่าน Setup Modal — ไม่ต้อง restart:

```
Setup Modal → Toggle switch per provider
           → POST /api/setup { provider, enabled: bool }
           → Cache 5s in memory + persist DB
           → Scanner skip disabled provider in next cycle
           → Gateway filter candidates ทันที (hot reload)
```

---

## 📐 Key Design Decisions

1. **Rule-based exam > Judge AI** — ตรวจแบบ deterministic = 0 cost + 100ms + ไม่สุ่ม
2. **Exponential cooldown cap ที่ 8 นาที** — ป้องกัน candidate pool หาย → 503 cascade
3. **Separate quota fail vs capacity fail** — Quota fail (429/TPM) ไม่นับเป็น capacity; model ยังรับได้จริง
4. **Provider-first candidate selection** — Group by provider → sort providers by live score → within provider sort models
5. **Size filter ใช้ × 1.4** — เผื่อ response + safety margin
6. **Per-attempt timeout dynamic** — Request ใหญ่ timeout ยาวขึ้น
7. **Ollama skip ถ้ามี cloud alternative + not loaded** — ประหยัดเวลา cold-load
8. **Hedge race เฉพาะ non-tools** — Tools request ไม่ parallel เพื่อประหยัด quota
9. **Category boost ก่อน sort** — ผู้ชนะ category ขึ้นบนเสมอ
10. **Live score in-memory (EMA)** — ไม่ต้องรอ DB round-trip ข้าม request

---

## 📄 License

Private project — BC Account.
