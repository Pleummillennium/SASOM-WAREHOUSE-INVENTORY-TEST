# SASOM Warehouse Inventory & Shelf Allocation System

ระบบจัดการคลังสินค้าที่จัดสรร Slot บนชั้นวางโดยอัตโนมัติตามประเภทและความสูงของสินค้า พร้อม UI สำหรับ monitor และ search

---

## Features Beyond Requirements

สิ่งที่เพิ่มเติมจาก requirement หลัก:

| Feature | รายละเอียด |
|---------|-----------|
| **Run Allocation Button** | กด button ใน Dashboard เพื่อ trigger allocation algorithm ได้เลย พร้อม toast notification แสดงผล allocated/skipped แบบ real-time |
| **Allocation Stats Dashboard** | แสดง 4 stat cards: Total Shelves, Orders Allocated, Skipped Orders, Allocation Rate (%) |
| **Per-Category Breakdown** | Progress bar แสดง allocation rate แยกตาม category พร้อมจำนวน skipped ของแต่ละ category |
| **Skipped Orders Panel** | คลิก "Skipped Orders" card เพื่อดูรายการ orders ที่ warehouse เต็มแบบละเอียด (orderId, product, category, boxHeight) |
| **Slot Visual Map** | Shelf detail แสดง grid 7×50 พร้อม color coding ตาม fill level — hover เพื่อดู orders ภายใน slot |
| **GET /api/allocate/stats** | Endpoint ใหม่ที่ return allocation summary + per-category breakdown + skipped orders list |

---

## System Overview

ระบบแบ่งออกเป็น 3 layer หลัก ทำงานร่วมกันดังนี้:

```
┌─────────────────────────────────────────────────────────┐
│                        Browser                          │
│                                                         │
│   ┌─────────────┐  ┌──────────────┐  ┌──────────────┐   │
│   │  Dashboard  │  │ Shelf Detail │  │ Search Page  │   │
│   │  (page.tsx) │  │ /shelves/[x] │  │  /search     │   │
│   └──────┬──────┘  └──────┬───────┘  └──────┬───────┘   │
│          │                │                 │           │
│          └────────────────┼─────────────────┘           │
│                           │  TanStack Query + Axios     │
└───────────────────────────┼─────────────────────────────┘
                            │ HTTP (localhost:3001)
┌───────────────────────────┼─────────────────────────────┐
│              Backend (Express.js + TypeScript)          │
│                           │                             │
│   ┌───────────────────────▼─────────────────────────┐   │
│   │                  Routes Layer                   │   │
│   │  /api/allocate   /api/shelves   /api/search     │   │
│   └───────────────────────┬─────────────────────────┘   │
│                           │                             │
│   ┌───────────────────────▼─────────────────────────┐   │
│   │              allocation.service.ts              │   │
│   │   (core algorithm: filter → sort → pack slots)  │   │
│   └───────────────────────┬─────────────────────────┘   │
│                           │  Prisma ORM                 │
└───────────────────────────┼─────────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────┐
│              PostgreSQL (Docker Container)              │
│                           │                             │
│   ┌──────────┐  ┌─────────▼──────┐  ┌───────────────┐   │
│   │  Shelf   │  │    Order       │  │ SlotAllocation│   │
│   │ (config) │  │ (10,000 rows)  │  │ (result rows) │   │
│   └──────────┘  └────────────────┘  └───────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Setup** — `db:setup` runs migrate → seed shelves → import 10,000 orders from CSV into DB
2. **Allocation** — `POST /api/allocate/run` triggers `allocation.service.ts` ซึ่ง:
   - Clear allocations เก่าทั้งหมด
   - Load shelves (sorted A→Z) และ orders (sorted by orderId ASC) จาก DB
   - วน loop assign แต่ละ order ไปยัง slot ที่เหมาะสม (in-memory)
   - Bulk insert ผลลัพธ์กลับเข้า DB ทีละ 500 rows
3. **Query** — Frontend fetch ข้อมูลผ่าน TanStack Query → แสดงผลบน UI แบบ real-time

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + TypeScript, Express.js |
| ORM | Prisma 7 + PostgreSQL |
| Frontend | Next.js 15 (App Router), Tailwind CSS, shadcn/ui |
| Data Fetching | TanStack Query (React Query) + Axios |
| Infrastructure | Docker Compose (PostgreSQL) |

---

## Prerequisites

- Node.js 18+
- Docker Desktop

---

## Setup & Run

### 1. Clone & install

```bash
git clone <repo-url>
cd sasom-warehouse

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

### 2. Environment

```bash
# backend/.env (copy from example)
cp backend/.env.example backend/.env
```

`backend/.env`:
```
DATABASE_URL="postgresql://sasom:sasom1234@localhost:5432/warehouse?schema=public"
PORT=3001
```

`frontend/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 3. Start PostgreSQL

```bash
docker compose up -d
```

### 4. วาง Dataset

วางไฟล์ dataset ที่ได้รับมาไว้ที่:

```
backend/data/ORDERS-10000-DATASET.csv
```

### 5. Setup database (migrate + seed + import)

```bash
cd backend
npm run db:setup
```

This runs in order:
1. `prisma migrate dev` — create tables
2. `seed-shelves.ts` — seed 30 shelf configurations
3. `import-orders.ts` — import orders from `data/ORDERS-10000-DATASET.csv` into DB

### 6. Run allocation algorithm

```bash
cd backend
npm run allocate
```

### 7. Start backend

```bash
cd backend
npm run dev     # http://localhost:3001
```

### 8. Start frontend

```bash
cd frontend
npm run dev     # http://localhost:3000
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/allocate/run` | Run allocation algorithm on all orders |
| `GET` | `/api/allocate/stats` | Allocation summary: total, allocated, skipped, per-category breakdown |
| `GET` | `/api/search/order/:orderId` | Find location of an order (e.g. `ORD00001`) |
| `GET` | `/api/search/slot?shelf=C&level=1&slot=1` | List orders in a specific slot |
| `GET` | `/api/shelves` | List all shelves with usage stats |
| `GET` | `/api/shelves/:shelfCode` | Shelf detail with full slot grid |

### Example Requests

```bash
# Search order
curl http://localhost:3001/api/search/order/ORD00001

# Search slot
curl "http://localhost:3001/api/search/slot?shelf=AD&level=1&slot=1"

# View shelf
curl http://localhost:3001/api/shelves/A

# Re-run allocation
curl -X POST http://localhost:3001/api/allocate/run
```

---

## Shelf Configuration

| Shelf | Category | Height Condition | Levels | Slot Height |
|-------|----------|-----------------|--------|-------------|
| A – B | Shoes | ≥ 16 cm | 7 | 48 cm |
| C – V | Shoes | < 16 cm | 7 | 48 cm |
| LBA – LBC | Bags | Any | 7 | 50 cm |
| AA – AC | Collectibles | Any | 7 | 33 cm |
| AD – AE | Apparel | Any | 7 | 33 cm |

---

## Allocation Algorithm

### Priority Order

เมื่อ assign order แต่ละใบ ระบบจะหา slot แรกที่ผ่านเงื่อนไขตามลำดับต่อไปนี้:

```
สำหรับแต่ละ order (เรียงตาม orderId ASC):
  1. หา eligible shelves → category ตรง + height condition ผ่าน
  2. วน Level 1 → 7  (ล่างสุดก่อน)
     วน Shelf A → Z  (alphabetical)
       วน Slot 1 → 50
         ถ้า usedHeight[slot] + boxHeight ≤ slotHeight → assign แล้ว break
  3. ถ้าไม่มี slot ว่างเลย → skip order นั้น
```

### Height Eligibility Rules

| Category | Shelf | เงื่อนไข |
|----------|-------|---------|
| Shoes | A, B | `boxHeight >= 16` cm |
| Shoes | C – V | `boxHeight < 16` cm |
| Bags | LBA – LBC | ไม่มีเงื่อนไขความสูง |
| Collectibles | AA – AC | ไม่มีเงื่อนไขความสูง |
| Apparel | AD – AE | ไม่มีเงื่อนไขความสูง |

### Slot Packing

หนึ่ง slot รับได้หลาย order พร้อมกัน โดย:

```
usedHeight[slot] + newOrder.boxHeight ≤ shelf.slotHeight  →  ใส่ได้
```

ตัวอย่าง — Shelf A (slotHeight = 48 cm):
```
Slot A-L1-1:  Order#1 boxHeight=20  → used=20  ✓
              Order#2 boxHeight=20  → used=40  ✓
              Order#3 boxHeight=10  → used=50  ✗ (50 > 48) → ต้องหา slot ถัดไป
```

### Re-run Behavior

เมื่อกด **Run Allocation** ซ้ำ:
- ลบ `SlotAllocation` ทั้งหมดก่อน (clean slate)
- รัน algorithm ใหม่ตั้งแต่ต้น
- ผลลัพธ์จะเหมือนเดิมเสมอ เพราะ orders และ shelves ไม่เปลี่ยน (deterministic)

### Why Orders Get Skipped

Order จะถูก skip เมื่อ warehouse เต็มจริง ๆ คือทุก slot ของ eligible shelves มี `usedHeight` เต็มแล้ว ไม่มีที่ว่างพอสำหรับ `boxHeight` ของ order นั้น

---

## Project Structure

```
/
├── docker-compose.yml
├── README.md
├── backend/
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── lib/prisma.ts
│   │   ├── routes/
│   │   │   ├── allocate.route.ts
│   │   │   ├── search.route.ts
│   │   │   └── shelves.route.ts
│   │   ├── services/
│   │   │   └── allocation.service.ts
│   │   ├── scripts/
│   │   │   ├── seed-shelves.ts
│   │   │   ├── import-orders.ts
│   │   │   ├── run-allocation.ts
│   │   │   └── test-allocation.ts
│   │   ├── app.ts
│   │   └── server.ts
│   └── package.json
└── frontend/
    ├── app/
    │   ├── page.tsx               # Dashboard
    │   ├── shelves/[shelfCode]/   # Shelf detail
    │   └── search/                # Search page
    ├── components/
    │   ├── Sidebar.tsx
    │   ├── ShelfCard.tsx
    │   ├── SlotGrid.tsx
    │   └── providers/QueryProvider.tsx
    └── lib/
        ├── api.ts
        ├── queries.ts
        └── types.ts
```

---

## Troubleshooting

### Docker / PostgreSQL

**ปัญหา:** `docker compose up -d` แล้ว port 5432 conflict
```bash
# ดูว่ามีอะไรใช้ port 5432 อยู่
lsof -i :5432

# ถ้าเป็น local PostgreSQL ให้หยุดก่อน (macOS)
brew services stop postgresql
```

**ปัญหา:** Container ขึ้นแล้วแต่ connect ไม่ได้
```bash
# ตรวจสอบ container status
docker compose ps

# ดู log ของ postgres container
docker compose logs db
```

---

### Database Setup

**ปัญหา:** `npm run db:setup` แล้วเจอ migration error
```bash
# Reset แล้วรันใหม่ทั้งหมด
cd backend
npx prisma migrate reset   # ลบ DB แล้วสร้างใหม่
npm run db:setup
```

**ปัญหา:** Import orders แล้วได้ 0 rows หรือ error
- ตรวจสอบว่าไฟล์อยู่ที่ `backend/data/ORDERS-10000-DATASET.csv` (ตรง path)
- ตรวจสอบว่า CSV มี header row: `orderId,category,boxHeight`
- ตรวจสอบ encoding ของไฟล์ต้องเป็น UTF-8

---

### Backend Server

**ปัญหา:** `npm run dev` แล้ว port 3001 conflict
```bash
# หา process ที่ใช้ port 3001
lsof -i :3001

# Kill process นั้น
kill -9 <PID>
```

**ปัญหา:** `Cannot find module` หรือ TypeScript error
```bash
cd backend
rm -rf node_modules
npm install
npm run dev
```

---

### Frontend

**ปัญหา:** หน้า Dashboard ขึ้นแต่ข้อมูลไม่แสดง / แสดง error
- ตรวจสอบว่า backend รันอยู่ที่ `http://localhost:3001`
- ตรวจสอบไฟล์ `frontend/.env.local` มี `NEXT_PUBLIC_API_URL=http://localhost:3001`
- เปิด Browser DevTools → Network tab ดูว่า API call ไป URL ไหนและ response เป็นอะไร

**ปัญหา:** `npm run dev` ของ frontend แล้ว error ด้าน dependency
```bash
cd frontend
rm -rf node_modules .next
npm install
npm run dev
```

---

### Allocation

**ปัญหา:** กด Run Allocation แล้วได้ 0 allocated
- ตรวจสอบว่า import orders สำเร็จแล้ว (`npm run db:import-orders`)
- ตรวจสอบว่า seed shelves สำเร็จแล้ว (`npm run db:seed-shelves`)
- ลองเรียก `GET /api/shelves` และ `GET /api/allocate/stats` ดูตรง ๆ

---

## Available Scripts

### Backend (`cd backend`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot-reload |
| `npm run build` | Compile TypeScript |
| `npm run db:setup` | Full DB setup (migrate + seed + import) |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:seed-shelves` | Seed shelf configurations |
| `npm run db:import-orders` | Import orders from CSV |
| `npm run allocate` | Run allocation algorithm |
| `npm run test:allocation` | Run unit tests for allocation logic |
| `npm run lint` | Run ESLint |

### Frontend (`cd frontend`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
