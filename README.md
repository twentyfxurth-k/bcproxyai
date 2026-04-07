# BCProxyAI 🦐

> **AI Gateway อัจฉริยะ** — รวม AI ฟรีจาก 13 ผู้ให้บริการ 200+ โมเดล ไว้ในที่เดียว
> ใช้ผ่าน **OpenAI-compatible API** — เปลี่ยนแค่ `base_url` ก็ใช้ได้ทันที

โรงเรียน AI ที่มี **น้องกุ้ง 🦐** และ **OpenClaw 🦞** เป็นมาสคอต — คัดเด็กเก่งให้คุณอัตโนมัติ ผ่านระบบสอบ ใบเตือน และ smart routing แบบ real-time

---

## สารบัญ

- [ฟีเจอร์เด่น](#ฟีเจอร์เด่น)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Providers ที่รองรับ](#providers-ที่รองรับ-13-ตัว)
- [Dashboard Sections](#dashboard-sections)
- [API Endpoints](#api-endpoints)
- [Background Worker](#background-worker)
- [Database Schema](#database-schema)
- [Caddy Reverse Proxy](#caddy-reverse-proxy)
- [OpenClaw Integration](#openclaw-integration)
- [Project Structure](#project-structure)
- [Testing](#testing)

---

## ฟีเจอร์เด่น

- 🎯 **Smart Routing** — เลือก provider/model ที่เหมาะกับ prompt อัตโนมัติ ตามประเภทคำถาม (coding/translation/reasoning/general)
- 🏥 **Health Monitoring** — ping ทุก provider ทุกชั่วโมง, cooldown 15 นาที เมื่อ fail
- 📊 **Live Theater** — banner แอนิเมชั่น 🦐🦞 ดึงจากสมุดจดงาน (gateway logs) จริง พร้อม confetti/tear effects
- 🗓️ **Score Heatmap** — ตารางเกรด provider × วัน 14 วัน, สีบอกระดับทันที
- 🏆 **Leaderboard** — อันดับ provider พร้อม animation count-up + medal
- 📈 **Stacked Area** — สัดส่วน traffic per provider per day
- 🛎️ **School Bell** — event stream แบบ real-time แจ้ง provider down/recovered
- 💸 **Cost Optimizer** — token budget + forecast รายวัน
- ⚠️ **Auto Complaint** — ตรวจจับคำตอบแย่อัตโนมัติแล้ว retest
- 📚 **Gateway Logs** — audit trail ของ request/response ทุกครั้ง
- 🐳 **Docker Ready** — ไฟล์เดียว `docker compose up -d` เสร็จเลย

---

## Tech Stack

| Layer | Tech | Version |
|-------|------|---------|
| Framework | Next.js | 16.2.2 (App Router) |
| UI | React | 19.2.4 |
| Styling | Tailwind CSS | v4 |
| Language | TypeScript | 5.x |
| Database | SQLite (better-sqlite3) | 12.8.0 |
| AI SDKs | @ai-sdk/openai, @anthropic-ai/sdk, @modelcontextprotocol/sdk | latest |
| Scheduler | node-cron | 4.2.1 |
| Testing | Vitest | 4.1.2 |
| Runtime | Node.js | 20-alpine (Docker) |
| Reverse Proxy | Caddy | (host-side) |
| Package Manager | npm | — |

---

## Quick Start

### Docker (แนะนำ)

```bash
# 1. clone + เข้าโฟลเดอร์
git clone https://github.com/jaturapornchai/bcproxyai.git
cd bcproxyai

# 2. สร้างไฟล์ .env.local แล้วใส่ API keys (ดูหัวข้อ Environment Variables)
cp .env.example .env.local
# แก้ไข .env.local

# 3. start
docker compose up -d --build

# 4. เปิด browser
open http://localhost:3334
```

หลัง start แล้ว:
- **Direct**: `http://localhost:3334` (port ของ container)
- **ผ่าน Caddy**: `http://localhost:3333` (ถ้ารัน Caddy ด้วย)
- **OpenAI base URL**: `http://localhost:3334/v1`

### Local Development (ไม่ใช้ Docker)

```bash
npm install
npm run dev          # dev server ที่ http://localhost:3000
npm run build        # production build
npm start            # run production
npm test             # vitest
npm test:watch       # vitest watch mode
```

---

## Environment Variables

ไฟล์: `.env.local` (อย่า commit เข้า git)

### จำเป็น

```bash
OPENROUTER_API_KEY=sk-or-v1-xxxxx     # https://openrouter.ai (ฟรี)
GROQ_API_KEY=gsk_xxxxx                # https://console.groq.com (ฟรี)
```

### ตัวเลือก (ใส่เพิ่มได้ตามต้องการ)

```bash
GOOGLE_AI_API_KEY=xxxxx               # https://aistudio.google.com (ฟรี)
CEREBRAS_API_KEY=csk-xxxxx            # https://cloud.cerebras.ai (ฟรี)
SAMBANOVA_API_KEY=xxxxx               # https://cloud.sambanova.ai (ฟรี)
MISTRAL_API_KEY=xxxxx                 # https://mistral.ai (ฟรี ต้อง verify เบอร์)
KILO_API_KEY=xxxxx                    # https://kilo.ai
GITHUB_API_KEY=ghp_xxxxx              # GitHub Models
FIREWORKS_API_KEY=xxxxx               # https://fireworks.ai
COHERE_API_KEY=xxxxx                  # https://cohere.com
HF_API_KEY=hf_xxxxx                   # https://huggingface.co
CLOUDFLARE_ACCOUNT_ID=xxxxx           # Cloudflare Workers AI
CLOUDFLARE_API_KEY=xxxxx
DEEPSEEK_API_KEY=xxxxx                # ใช้เป็น judge ตอน benchmark (ถูกมาก)

# Local Ollama (ไม่ต้องตั้งถ้าใช้ default)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_API_KEY=ollama
```

ระบบจะ detect อัตโนมัติว่า provider ไหนพร้อมใช้ — ไม่ใส่ key ก็ข้ามไป ไม่ error

---

## Providers ที่รองรับ (13 ตัว)

| # | Provider | Endpoint | หมายเหตุ |
|---|----------|----------|----------|
| 1 | **OpenRouter** | `openrouter.ai/api/v1` | embeddings + legacy completions |
| 2 | **Groq** | `api.groq.com/openai/v1` | inference เร็วมาก |
| 3 | **Google AI** | `generativelanguage.googleapis.com/v1beta/openai` | Gemini, มี free tier |
| 4 | **Mistral** | `api.mistral.ai/v1` | embeddings |
| 5 | **Cerebras** | `api.cerebras.ai/v1` | free credits |
| 6 | **SambaNova** | `api.sambanova.ai/v1` | high throughput |
| 7 | **Kilo** | `api.kilo.ai/api/gateway` | aggregator |
| 8 | **Ollama** | `localhost:11434/v1` | local LLM |
| 9 | **GitHub Models** | `models.github.ai/inference` | ใช้ GitHub token |
| 10 | **Fireworks** | `api.fireworks.ai/inference/v1` | serverless |
| 11 | **Cohere** | `api.cohere.com/v2` | Command models |
| 12 | **Cloudflare Workers AI** | `api.cloudflare.com/.../ai/v1` | edge inference |
| 13 | **Hugging Face** | `router.huggingface.co/v1` | HF Inference API |

---

## Dashboard Sections

หน้า `/` ประกอบด้วย 12 sections (อ้างอิงจาก [src/app/page.tsx](src/app/page.tsx)):

| # | Section ID | ชื่อ | คำอธิบาย |
|---|------------|------|----------|
| — | (top) | 🎬 **Mascot Theater** | Banner แอนิเมชั่น 🦐🦞 ดึง gateway logs จริง พร้อม live stats |
| 1 | `#status` | สถานะ Worker | จำนวนโมเดล, recent activity, worker state |
| 2 | `#providers` | Providers | grid แสดง provider ทั้งหมด พร้อมสถานะ |
| 3 | `#rankings` | อันดับนักเรียน | top models เรียงตามคะแนน |
| 4 | `#chat` | Chat Panel | ทดลองคุยกับโมเดลโดยตรง |
| 5 | `#smart-routing` | จัดห้องเรียนอัตโนมัติ | routing stats แยกตาม category |
| 6 | `#trend` | พัฒนาการนักเรียน | 3 กราฟ: heatmap + leaderboard + stacked area |
| 7 | `#uptime` | Uptime | % uptime + cooldown counts ต่อ provider |
| 8 | `#cost-opt` | Cost Optimizer | token budget + forecast |
| 9 | `#school-bell` | หลังเรียน 🛎️ | event stream แบบ real-time |
| 10 | `#complaints` | ใบเตือน | issues + failed exams |
| 11 | `#gateway-logs` | สมุดจดงาน | request/response audit trail |
| 12 | `#logs` | Logs | worker activity log |

---

## API Endpoints

### OpenAI-Compatible Proxy (ใช้แทน OpenAI ได้เลย)

ตั้ง `base_url = http://localhost:3334/v1` แล้วใช้ SDK ของ OpenAI ได้ทันที

| Method | Route | คำอธิบาย |
|--------|-------|----------|
| POST | `/v1/chat/completions` | **หลัก** — smart routing เลือกโมเดลให้อัตโนมัติ |
| GET | `/v1/models` | list โมเดลที่ค้นพบทั้งหมด |
| GET | `/v1/models/[model]` | detail ของโมเดลเดียว |
| POST | `/v1/embeddings` | text embeddings |
| POST | `/v1/completions` | legacy text completion |
| POST | `/v1/images/generations` | สร้างภาพ |
| POST | `/v1/audio/speech` | TTS |
| POST | `/v1/audio/transcriptions` | STT |
| POST | `/v1/audio/translations` | แปลเสียง |
| POST | `/v1/moderations` | content moderation |

### Admin / Status APIs

| Route | คำอธิบาย |
|-------|----------|
| `GET /api/health` | health check รวม: db + providers + worker + gateway success rate |
| `GET /api/status` | worker state + model counts + recent logs |
| `GET /api/providers` | provider config + key status + model counts |
| `GET /api/models?provider=X` | list โมเดล (filter ตาม provider ได้) |
| `GET /api/gateway-logs?limit=100&offset=0` | request/response audit trail |
| `POST /api/chat` | direct chat test `{modelId, provider, messages}` |
| `GET /api/leaderboard` | top models by score |
| `GET /api/trend` | benchmark/complaint/latency trends 14 วัน |
| `GET /api/uptime` | per-provider uptime % + cooldown |
| `GET /api/cost-optimizer` | token budget + estimated cost |
| `GET /api/cost-savings` | cumulative cost by provider |
| `GET /api/analytics` | aggregate stats |
| `POST /api/complaint` | file complaint `{modelId, category, reason, messages}` |
| `GET /api/events` | real-time event stream (SSE) |
| `GET /api/routing-stats` | per-model performance by category |
| `POST /api/budget` | set token budget |
| `GET /api/worker` | trigger หรือ check worker cycle |
| `GET /api/setup` | onboarding |

### ตัวอย่างใช้งาน (Python)

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:3334/v1",
    api_key="sk-anything",  # ไม่ต้องใช้ key จริง
)

resp = client.chat.completions.create(
    model="auto",  # ให้ smart routing เลือกให้
    messages=[{"role": "user", "content": "สวัสดี"}],
)
print(resp.choices[0].message.content)
```

### ตัวอย่างใช้งาน (curl)

```bash
curl http://localhost:3334/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "auto",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

---

## Background Worker

[src/lib/worker/](src/lib/worker/) — รันอัตโนมัติทุก 1 ชั่วโมง

หน้าที่:
1. **Scan** — ค้นหาโมเดลใหม่จากทุก provider ที่ตั้ง API key
2. **Health Check** — ping แต่ละโมเดล, ถ้า fail → cooldown 15 นาที
3. **Benchmark** — (option) สอบโมเดลด้วยข้อสอบมาตรฐาน → ให้คะแนน
4. **Auto-complaint** — วิเคราะห์คำตอบแย่ → record + retest

State persisted ใน table `worker_state`, log ใน `worker_logs`

---

## Database Schema

SQLite ที่ `/app/data/bcproxyai.db` (Docker) หรือ `./data/bcproxyai.db` (local)

Schema: [src/lib/db/schema.ts](src/lib/db/schema.ts) — 14 tables หลัก:

| Table | คำอธิบาย |
|-------|----------|
| `models` | โมเดลที่ค้นพบ + capabilities |
| `health_logs` | health/latency/cooldown ต่อ provider |
| `benchmark_results` | ผลสอบ benchmark |
| `gateway_logs` | request/response audit trail |
| `complaints` | issues ที่ user/AI report |
| `complaint_exams` | ผล retest หลังร้องเรียน |
| `routing_stats` | performance per model per category |
| `events` | real-time notifications (school bell) |
| `token_usage` | cost tracking |
| `worker_state` | worker checkpoint |
| `worker_logs` | worker activity log |
| `cooldowns` | provider cooldown table |
| `api_keys` | encrypted key store |
| `routing_decisions` | smart routing decision log |

---

## Caddy Reverse Proxy

ไฟล์: [Caddyfile](Caddyfile)

```caddy
{
    admin off
    auto_https off
}

:3333 {
    reverse_proxy 127.0.0.1:3334 {
        flush_interval -1
        transport http {
            read_timeout 300s
            write_timeout 300s
        }
    }
}

:18790 {
    reverse_proxy 127.0.0.1:18791 {
        flush_interval -1
        transport http {
            read_timeout 600s
            write_timeout 600s
        }
    }
}
```

| Port | ใช้ทำอะไร |
|------|------------|
| `3333` | BCProxyAI ผ่าน Caddy (timeout 300s) |
| `3334` | BCProxyAI direct (Docker port) |
| `18790` | OpenClaw gateway ผ่าน Caddy (timeout 600s) |
| `18791` | OpenClaw direct (Docker port) |

รัน Caddy บน Windows:
```powershell
caddy run --config Caddyfile
```

---

## OpenClaw Integration

BCProxyAI เป็น **unified model gateway** สำหรับ OpenClaw agent framework

### ตั้งค่าใน OpenClaw

```bash
docker exec <openclaw-container> openclaw onboard
```

หรือแก้ `~/.openclaw/openclaw.json` ตรงๆ:

```json
{
  "models": {
    "providers": {
      "bcproxy-local": {
        "baseUrl": "http://host.docker.internal:3334/v1",
        "apiKey": "dummy",
        "api": "openai-completions",
        "models": [{
          "id": "auto",
          "name": "BCProxyAI Auto",
          "contextWindow": 131072,
          "maxTokens": 8192
        }]
      }
    }
  }
}
```

### Device Pairing

OpenClaw control UI ต้อง pair device ก่อนใช้งาน:

```bash
docker exec <openclaw-container> openclaw devices list
docker exec <openclaw-container> openclaw devices approve <requestId>
```

หรือเข้าจาก localhost จะ auto-approve

### LAN HTTP-only mode

ถ้าจะให้คนอื่นใน LAN เข้าถึง OpenClaw control UI ผ่าน HTTP (ไม่ใช่ HTTPS):

```bash
docker exec <openclaw-container> openclaw config set gateway.controlUi.dangerouslyDisableDeviceAuth true
docker restart <openclaw-container>
```

⚠️ ใช้เฉพาะใน LAN ที่เชื่อใจได้ อย่าเปิดออก internet

---

## Project Structure

```
.
├── src/
│   ├── app/
│   │   ├── page.tsx              # Dashboard หลัก
│   │   ├── layout.tsx
│   │   ├── globals.css           # animations + glass effects
│   │   ├── api/                  # 18+ admin API routes
│   │   │   ├── health/
│   │   │   ├── status/
│   │   │   ├── providers/
│   │   │   ├── models/
│   │   │   ├── gateway-logs/
│   │   │   ├── chat/
│   │   │   ├── leaderboard/
│   │   │   ├── trend/
│   │   │   ├── uptime/
│   │   │   ├── cost-optimizer/
│   │   │   ├── complaint/
│   │   │   ├── events/
│   │   │   ├── routing-stats/
│   │   │   └── ...
│   │   └── v1/                   # OpenAI-compatible proxy
│   │       ├── chat/completions/
│   │       ├── models/
│   │       ├── embeddings/
│   │       └── ...
│   ├── components/
│   │   ├── MascotScene.tsx       # 🦐🦞 live theater
│   │   ├── TrendPanel.tsx        # heatmap + leaderboard + stacked area
│   │   ├── GuideModal.tsx        # OpenClaw onboarding guide
│   │   ├── SetupModal.tsx        # API key setup
│   │   └── shared.ts
│   └── lib/
│       ├── db/schema.ts          # SQLite schema (14 tables)
│       ├── worker/               # background scanner/health/benchmark
│       ├── providers.ts          # provider URLs + config
│       ├── api-keys.ts
│       ├── openai-compat.ts
│       ├── routing-learn.ts      # smart routing logic
│       ├── auto-complaint.ts
│       └── cache.ts
├── Caddyfile                     # reverse proxy config
├── docker-compose.yml
├── Dockerfile                    # multi-stage Node 20 alpine
├── .env.example
├── package.json
└── README.md
```

---

## Testing

```bash
npm test              # run all vitest tests
npm test:watch        # watch mode
npm test:coverage     # coverage report
```

Tests อยู่ที่:
- [src/lib/worker/__tests__/](src/lib/worker/__tests__/) — worker logic
- [src/lib/__tests__/](src/lib/__tests__/) — utilities

---

## License

MIT

---

🦐 _Made with น้องกุ้ง + 🦞 OpenClaw_
