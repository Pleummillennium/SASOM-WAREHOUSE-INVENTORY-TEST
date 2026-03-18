# Codebase Documentation — SASOM Warehouse Inventory System

เอกสารนี้อธิบายทุกไฟล์ ทุก function และความสัมพันธ์ระหว่างกันในโปรเจคนี้

---

## สารบัญ

1. [ภาพรวมระบบ](#1-ภาพรวมระบบ)
2. [โครงสร้าง Folder](#2-โครงสร้าง-folder)
3. [Data Flow — ข้อมูลไหลยังไง](#3-data-flow)
4. [Backend](#4-backend)
   - [Database Schema](#41-database-schema)
   - [Infrastructure](#42-infrastructure)
   - [Core Algorithm](#43-core-algorithm)
   - [API Routes](#44-api-routes)
   - [Scripts](#45-scripts)
5. [Frontend](#5-frontend)
   - [Providers & Layout](#51-providers--layout)
   - [Pages](#52-pages)
   - [Components](#53-components)
   - [Lib (Types, API, Queries)](#54-lib)
6. [Dependency Map — เชื่อมต่อกันยังไง](#6-dependency-map)
7. [API Reference ครบถ้วน](#7-api-reference)

---

## 1. ภาพรวมระบบ

```
User Browser
    │
    ▼
Frontend (Next.js :3000)
    │  HTTP via Axios
    ▼
Backend (Express :3001)
    │  Prisma ORM
    ▼
PostgreSQL (:5432)  ←── Docker Container
```

ระบบแบ่งเป็น 3 ชั้น:

| ชั้น | เทคโนโลยี | หน้าที่ |
|------|-----------|---------|
| **Frontend** | Next.js 15 + React | แสดงผล + รับ input จาก user |
| **Backend** | Express.js + TypeScript | business logic + API |
| **Database** | PostgreSQL + Prisma | เก็บข้อมูลถาวร |

---

## 2. โครงสร้าง Folder

```
SASOM-WAREHOUSE-INVENTORY-TEST/
│
├── docker-compose.yml          ← รัน PostgreSQL container
├── README.md                   ← คู่มือ setup + run
├── CODEBASE.md                 ← เอกสารนี้
│
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       ← นิยาม DB schema (3 tables)
│   │   └── migrations/         ← SQL migration files (auto-generated)
│   ├── prisma.config.ts        ← config Prisma CLI (ชี้ DB URL)
│   ├── src/
│   │   ├── lib/
│   │   │   └── prisma.ts       ← สร้าง PrismaClient singleton
│   │   ├── services/
│   │   │   └── allocation.service.ts  ← หัวใจระบบ: allocation algorithm
│   │   ├── routes/
│   │   │   ├── allocate.route.ts      ← POST /run + GET /stats
│   │   │   ├── search.route.ts        ← GET /order/:id + GET /slot
│   │   │   └── shelves.route.ts       ← GET /shelves + GET /shelves/:code
│   │   ├── scripts/
│   │   │   ├── generate-orders.ts     ← สร้าง mock CSV 10,000 rows
│   │   │   ├── seed-shelves.ts        ← seed shelf config ลง DB
│   │   │   ├── import-orders.ts       ← import CSV → DB
│   │   │   ├── run-allocation.ts      ← CLI runner สำหรับ algorithm
│   │   │   └── test-allocation.ts     ← unit tests (ไม่ใช้ DB)
│   │   ├── app.ts              ← สร้าง Express app + wire routes
│   │   └── server.ts           ← entry point: listen port
│   ├── package.json
│   ├── tsconfig.json
│   └── eslint.config.mjs
│
└── frontend/
    ├── app/
    │   ├── layout.tsx           ← Root layout: Sidebar + QueryProvider + Toaster
    │   ├── page.tsx             ← Dashboard page
    │   ├── search/
    │   │   └── page.tsx         ← Search page (by Order ID / by Slot)
    │   └── shelves/
    │       └── [shelfCode]/
    │           └── page.tsx     ← Shelf detail page
    ├── components/
    │   ├── Sidebar.tsx          ← Navigation sidebar
    │   ├── ShelfCard.tsx        ← Card แสดง shelf + usage bar
    │   ├── SlotGrid.tsx         ← Visual grid 7×50 slots
    │   ├── RunAllocationButton.tsx  ← ปุ่ม trigger algorithm
    │   ├── providers/
    │   │   └── QueryProvider.tsx    ← React Query context
    │   └── ui/                  ← shadcn/ui components (auto-generated)
    ├── lib/
    │   ├── api.ts               ← Axios instance (base URL)
    │   ├── queries.ts           ← React Query hooks ทุกตัว
    │   ├── types.ts             ← TypeScript interfaces ทุกตัว
    │   └── utils.ts             ← cn() helper (shadcn)
    └── package.json
```

---

## 3. Data Flow

### 3.1 Setup Flow (ทำครั้งเดียวตอน init)

```
generate-orders.ts
    │  สร้าง random 10,000 orders
    ▼
data/orders.csv
    │
    ▼
import-orders.ts ──────────────────► orders table (10,000 rows)
seed-shelves.ts  ──────────────────► shelves table (30 rows)
prisma migrate dev ────────────────► สร้าง tables ทั้งหมด
```

### 3.2 Allocation Flow

```
POST /api/allocate/run
    │
    ▼
allocation.service.ts: runAllocation()
    │
    ├── 1. DELETE all slot_allocations
    ├── 2. SELECT all shelves (ORDER BY shelfCode ASC)
    ├── 3. SELECT all orders (ORDER BY orderId ASC)
    ├── 4. Loop orders → หา slot ที่เหมาะ (in-memory Map)
    └── 5. INSERT slot_allocations (batch 500)
    │
    ▼
slot_allocations table (7,890 rows)
```

### 3.3 Frontend Data Flow

```
Browser loads page
    │
    ▼
QueryProvider (React Query context)
    │
    ▼
useAllocationStats() → GET /api/allocate/stats → แสดง stat cards
useShelves()         → GET /api/shelves         → แสดง ShelfCards
    │
User คลิก ShelfCard
    │
    ▼
useShelfDetail(code) → GET /api/shelves/:code   → แสดง SlotGrid
    │
User กด "Run Allocation"
    │
    ▼
useRunAllocation() → POST /api/allocate/run
    │  onSuccess:
    └── invalidateQueries(['allocation', 'shelves'])
        → React Query re-fetch ทุก query อัตโนมัติ
        → UI อัพเดทตัวเอง
```

---

## 4. Backend

### 4.1 Database Schema

**ไฟล์:** `backend/prisma/schema.prisma`

#### Model: `Order` → table `orders`

| Column | Type | คำอธิบาย |
|--------|------|---------|
| `id` | Int (PK, auto) | internal ID |
| `orderId` | String (unique) | รหัส order เช่น `ORD00001` |
| `productName` | String | ชื่อสินค้า |
| `price` | Float | ราคา (บาท) |
| `category` | String | `shoes` / `bags` / `collectibles` / `apparel` |
| `boxHeight` | Float | ความสูงกล่อง (cm) |

Relation: `allocation SlotAllocation?` → Order หนึ่งตัวมี allocation ได้ 0 หรือ 1 ตัว (optional one-to-one)

---

#### Model: `Shelf` → table `shelves`

| Column | Type | คำอธิบาย |
|--------|------|---------|
| `id` | Int (PK, auto) | internal ID |
| `shelfCode` | String (unique) | รหัส shelf เช่น `A`, `LBA`, `AA` |
| `category` | String | ประเภทสินค้าที่รับได้ |
| `minBoxHeight` | Float? | ความสูงขั้นต่ำ (null = ไม่จำกัด) |
| `maxBoxHeight` | Float? | ความสูงสูงสุด (null = ไม่จำกัด) |
| `totalLevels` | Int | จำนวน level (ทุก shelf = 7) |
| `slotHeight` | Float | ความสูง slot (cm) — กำหนดว่าวางซ้อนได้เท่าไหร่ |
| `totalSlots` | Int | จำนวน slot ต่อ level (ทุก shelf = 50) |

Relation: `allocations SlotAllocation[]` → Shelf มีหลาย allocation

---

#### Model: `SlotAllocation` → table `slot_allocations`

| Column | Type | คำอธิบาย |
|--------|------|---------|
| `id` | Int (PK, auto) | internal ID |
| `orderId` | String (unique, FK → orders) | order ที่ถูก assign |
| `shelfCode` | String (FK → shelves) | ชั้นวางที่ assign ไป |
| `level` | Int | Level (1–7) |
| `slot` | Int | Slot (1–50) |
| `allocatedAt` | DateTime | เวลาที่ assign |

ความสัมพันธ์:
- `SlotAllocation.order` → join กับ `Order`
- `SlotAllocation.shelf` → join กับ `Shelf`

> หนึ่ง `orderId` มีได้แค่ 1 allocation (unique constraint) → order วางได้แค่ที่เดียว

---

### 4.2 Infrastructure

#### `backend/prisma.config.ts`

```
dotenv/config  →  โหลด .env
defineConfig() →  บอก Prisma CLI ว่า:
                  - schema อยู่ที่ prisma/schema.prisma
                  - migrations อยู่ที่ prisma/migrations/
                  - DATABASE_URL มาจาก environment variable
```

**เชื่อมกับ:** `.env` (DATABASE_URL), ใช้โดย `npx prisma migrate dev`

---

#### `backend/src/lib/prisma.ts`

```typescript
const adapter = new PrismaPg({ connectionString: DATABASE_URL })
const prisma = new PrismaClient({ adapter })
export default prisma
```

**หน้าที่:** สร้าง PrismaClient singleton ที่ใช้ `@prisma/adapter-pg` เชื่อมต่อ PostgreSQL

**ทำไมต้องมี adapter?** Prisma 7 เปลี่ยน architecture — URL ไม่อยู่ใน schema.prisma แล้ว ต้องส่งผ่าน driver adapter แทน

**ถูก import โดย:**
- `allocation.service.ts`
- `routes/allocate.route.ts`
- `routes/search.route.ts`
- `routes/shelves.route.ts`
- `scripts/seed-shelves.ts`
- `scripts/import-orders.ts`

---

#### `backend/src/app.ts`

```
cors()           → อนุญาต cross-origin request (frontend port 3000 → backend port 3001)
express.json()   → parse request body เป็น JSON อัตโนมัติ
/api/allocate    → allocate.route.ts
/api/search      → search.route.ts
/api/shelves     → shelves.route.ts
/api/health      → { status: "ok" }
404 handler      → return { success: false, message: "Route not found" }
Error handler    → catch error จาก next(err) → return 500
```

**เชื่อมกับ:** `server.ts` (import app แล้ว listen), ทุก route files

---

#### `backend/src/server.ts`

```typescript
import app from './app'
app.listen(PORT)  // PORT จาก .env หรือ default 3001
```

**หน้าที่:** entry point เดียวของ backend — รัน `npm run dev` แล้วไฟล์นี้ถูกเรียกก่อน

---

### 4.3 Core Algorithm

#### `backend/src/services/allocation.service.ts`

**หัวใจของระบบทั้งหมด** — ไฟล์นี้ทำสิ่งที่โจทย์ต้องการ

---

##### Type: `SlotKey`

```typescript
type SlotKey = string  // format: "${shelfCode}|${level}|${slot}"
```

ใช้เป็น key ใน Map สำหรับ track ความสูงสะสม เช่น `"A|1|3"` = Shelf A, Level 1, Slot 3

---

##### Function: `slotKey(shelfCode, level, slot) → string`

```
input:  "A", 1, 3
output: "A|1|3"
```

สร้าง unique key สำหรับ slot หนึ่งตัว ใช้เป็น key ใน HashMap

---

##### Function: `getEligibleShelves(shelves, category, boxHeight) → Shelf[]`

```
input:  shelves ทั้งหมด, category="shoes", boxHeight=12
output: เฉพาะ shelf ที่ตรงเงื่อนไขทั้งหมด

เงื่อนไข:
  1. shelf.category === category
  2. ถ้า minBoxHeight มีค่า → boxHeight ต้อง >= minBoxHeight
  3. ถ้า maxBoxHeight มีค่า → boxHeight ต้อง <= maxBoxHeight
```

ตัวอย่าง: shoes height=12 → ผ่านเฉพาะ shelf C–V (maxBoxHeight=15) ไม่ผ่าน A–B (minBoxHeight=16)

---

##### Function: `runAllocation() → Promise<AllocationResult>` ⭐ (หัวใจหลัก)

ลำดับการทำงาน:

```
1. DELETE all slot_allocations
   └── เพื่อให้ re-run ได้ทุกเมื่อ (idempotent)

2. SELECT shelves ORDER BY shelfCode ASC
   └── เรียง A, AA, AB, AC, AD, AE, B, C, D ... LBA, LBB, LBC ...

3. SELECT orders ORDER BY orderId ASC
   └── ORD00001, ORD00002, ... ORD10000

4. สร้าง Map<SlotKey, number> สำหรับ track usedHeight
   └── เริ่มต้น empty ทุก slot used = 0

5. Loop ทุก order:
   a. getEligibleShelves(order.category, order.boxHeight)
   b. Triple loop หาที่วาง:
      for level = 1 → 7:
        for shelf of eligibleShelves (alphabetical):
          for slot = 1 → 50:
            if usedHeight[shelf|level|slot] + order.boxHeight <= shelf.slotHeight:
              → assign! เพิ่ม height ใน Map, เก็บไว้ใน allocations[]
              → break ออกจาก loop ทั้งหมด (labeled break outer:)
   c. ถ้าหาไม่ได้ → push ลง skippedOrders[]

6. Bulk INSERT allocations ลง DB (batch 500 rows)
   └── เร็วกว่า insert ทีละ row มาก

7. Return { allocated, skipped, skippedOrders }
```

**ทำไม in-memory Map ไม่ query DB?**

ถ้า query DB ทุก order (10,000 ครั้ง × 3 nested loops) จะช้ามาก Map ทำให้ O(1) lookup ใน RAM — algorithm ทั้งหมดรันใน 0.79 วินาที

**เชื่อมกับ:**
- `prisma.ts` → query/insert DB
- `allocate.route.ts` → เรียกผ่าน API
- `run-allocation.ts` → เรียกผ่าน CLI

---

### 4.4 API Routes

#### `backend/src/routes/allocate.route.ts`

Mount ที่: `/api/allocate`

---

##### `GET /api/allocate/stats`

**หน้าที่:** ดึง allocation summary โดยไม่ต้อง re-run algorithm

```
Query ทั้งหมด:
  1. prisma.order.count()              → จำนวน orders ทั้งหมด
  2. prisma.slotAllocation.count()     → จำนวนที่ allocated แล้ว
  3. prisma.order.findMany(where: allocation=null)
                                       → skipped orders (ไม่มี allocation)
  4. prisma.order.groupBy(['category'])         → รวมต่อ category
  5. prisma.order.findMany(where: allocation!=null) → นับ allocated ต่อ category

Response:
{
  totalOrders: 10000,
  allocated: 7890,
  skipped: 2110,
  byCategory: [
    { category: "shoes", total: 4000, allocated: 3071, skipped: 929 },
    ...
  ],
  skippedOrders: [ { orderId, category, boxHeight, productName }, ... ] (max 100)
}
```

**ถูกเรียกโดย:** `useAllocationStats()` ใน frontend

---

##### `POST /api/allocate/run`

**หน้าที่:** เรียก `runAllocation()` แล้ว return ผล

```
→ allocation.service.ts: runAllocation()
← { allocated: 7890, skipped: 2110, skippedOrders: [...] }
```

**ถูกเรียกโดย:** `useRunAllocation()` ใน frontend (เมื่อกดปุ่ม Run Allocation)

---

#### `backend/src/routes/search.route.ts`

Mount ที่: `/api/search`

---

##### `GET /api/search/order/:orderId`

**หน้าที่:** หาว่า order นี้อยู่ shelf/level/slot ไหน

```
Query:
  prisma.slotAllocation.findUnique({
    where: { orderId },
    include: { order: true }   ← JOIN กับ orders table
  })

Response (200):
{
  orderId: "ORD00001",
  productName: "Stüssy World Tour Tee",
  category: "apparel",
  boxHeight: 27,
  price: 16921.47,
  location: { shelfCode: "AD", level: 1, slot: 1 }
}

Response (404): order ไม่มี หรือ ไม่ได้ถูก allocate
```

---

##### `GET /api/search/slot?shelf=AD&level=1&slot=1`

**หน้าที่:** ดูว่า slot นี้มีของอะไรบ้าง

```
Validate: shelf, level, slot ต้องมีครบ + level/slot ต้องเป็นตัวเลข

Query:
  prisma.slotAllocation.findMany({
    where: { shelfCode, level, slot },
    include: { order: true }
  })

Response:
{
  location: { shelfCode: "AD", level: 1, slot: 1 },
  count: 2,
  orders: [
    { orderId: "ORD00001", productName: "...", category: "apparel", boxHeight: 27, price: 16921.47 },
    { orderId: "ORD00153", ... }
  ]
}
```

---

#### `backend/src/routes/shelves.route.ts`

Mount ที่: `/api/shelves`

---

##### `GET /api/shelves`

**หน้าที่:** ดูรายการ shelf ทั้งหมดพร้อม usage statistics

```
Query:
  1. prisma.shelf.findMany() → shelf configs ทั้งหมด
  2. prisma.slotAllocation.groupBy(['shelfCode','level','slot'])
     → นับ distinct slots ที่ถูกใช้งาน (slotsUsed)
  3. prisma.slotAllocation.groupBy(['shelfCode'])
     → นับ orders ต่อ shelf (ordersAllocated)

คำนวณ usagePercent:
  slotsUsed / (totalLevels × totalSlots) × 100
  → วัดว่ากี่ % ของ slot (ไม่ใช่ orders) ถูกใช้แล้ว

Response: array ของ shelf พร้อม ordersAllocated, slotsUsed, usagePercent
```

---

##### `GET /api/shelves/:shelfCode`

**หน้าที่:** ดู shelf นั้นละเอียด พร้อม slot grid ทุกช่อง

```
Query:
  1. prisma.shelf.findUnique({ where: { shelfCode } })
  2. prisma.slotAllocation.findMany({
       where: { shelfCode },
       include: { order: true },
       orderBy: [level ASC, slot ASC]
     })

สร้าง grid:
  grid = {}
  for level 1→7:
    grid[level] = {}
    for slot 1→50:
      grid[level][slot] = []   ← เริ่มต้นทุก slot ว่าง

  for each allocation:
    grid[level][slot].push({ orderId, productName, boxHeight, price })

Response:
{
  shelfCode, category, slotHeight, totalLevels, totalSlots, allocated,
  grid: {
    "1": { "1": [order1, order2], "2": [order3], "3": [], ... },
    "2": { ... },
    ...
  }
}
```

**ถูกเรียกโดย:** `useShelfDetail()` → แสดงใน `SlotGrid` component

---

### 4.5 Scripts

#### `backend/src/scripts/generate-orders.ts`

**หน้าที่:** สร้าง mock dataset 10,000 orders → `data/orders.csv`

```
Distribution:
  shoes (≥16cm) : 2,000 orders  → boxHeight: 16–40cm
  shoes (<16cm) : 2,000 orders  → boxHeight: 5–15cm
  bags          : 2,000 orders  → boxHeight: 10–49cm
  collectibles  : 2,000 orders  → boxHeight: 5–32cm
  apparel       : 2,000 orders  → boxHeight: 5–32cm

Process:
  1. สร้าง raw orders array ตาม distribution
  2. Shuffle array (Fisher-Yates algorithm)
  3. Assign orderId ตามลำดับ: ORD00001 → ORD10000
  4. Write เป็น CSV พร้อม header

Functions:
  randomInt(min, max)     → random integer (inclusive)
  randomFloat(min, max)   → random float 2 decimal places
  pick<T>(arr)            → เลือก element random จาก array
  generateOrders()        → สร้าง order array ทั้งหมด

Output: backend/data/orders.csv
```

---

#### `backend/src/scripts/seed-shelves.ts`

**หน้าที่:** seed ข้อมูล shelf configuration ตาม spec โจทย์ลง DB

```
ข้อมูลที่ seed (30 shelves):
  A, B          → shoes, minBoxHeight=16, slotHeight=48
  C–V (20 shelves) → shoes, maxBoxHeight=15, slotHeight=48
  LBA, LBB, LBC → bags, slotHeight=50
  AA, AB, AC    → collectibles, slotHeight=33
  AD, AE        → apparel, slotHeight=33

Functions:
  generateShelfCodes(start, end)  → สร้าง array ['A','B'] หรือ ['C','D',...,'V']
  generateLbaCodes()              → ['LBA','LBB','LBC']
  generateAaCodes(start, end)     → ['AA','AB','AC'] หรือ ['AD','AE']
  main()                          → deleteMany() แล้ว createMany()

Process:
  1. DELETE shelves ทั้งหมด (fresh seed)
  2. INSERT 30 shelves ในคำสั่งเดียว
```

---

#### `backend/src/scripts/import-orders.ts`

**หน้าที่:** อ่าน `orders.csv` แล้ว bulk insert ลง DB

```
Functions:
  parseCsv(filePath)  → อ่าน CSV → parse แต่ละ row
                        handle quoted fields (productName อาจมี comma)
                        return OrderRow[]
  main()              → deleteMany orders+allocations → batch insert

Process:
  1. Check ว่า data/orders.csv มีอยู่
  2. parseCsv → 10,000 rows
  3. DELETE slot_allocations ก่อน (FK constraint)
  4. DELETE orders
  5. INSERT orders ทีละ 500 rows (BATCH_SIZE)
  6. แสดง progress counter
```

---

#### `backend/src/scripts/run-allocation.ts`

**หน้าที่:** CLI runner — เรียก `runAllocation()` แล้ว print ผล

```
import { runAllocation } from '../services/allocation.service'
→ runAllocation()
← print: allocated, skipped, เวลาที่ใช้ (วินาที)
```

ใช้รัน: `npm run allocate`

---

#### `backend/src/scripts/test-allocation.ts`

**หน้าที่:** unit test algorithm โดยไม่ใช้ DB (pure function test)

```
replicate core logic ทั้งหมดใน file เดียว (copy จาก service)
สร้าง mock Shelf objects
รัน test cases:

Test cases (14 tests):
  1. Shoes ≥16 cm → ต้องได้ Shelf A (ไม่ใช่ C)
  2. Shoes <16 cm → ต้องได้ Shelf C (ไม่ใช่ A)
  3. Slot เต็ม → ขยับไป slot ถัดไป
     (slotHeight=48, box=16 → 3 ชิ้นพอดี → ชิ้นที่ 4 ต้อง slot 2)
  4. Bags → ต้องได้ LBA
  5. Box สูงเกิน slotHeight → skipped
  6. Level เต็มทั้ง 50 slots → ขึ้น level 2
  7. orderId sort → ORD00001 ได้ slot 1 ก่อนเสมอ

assert(name, condition) → print ✓ หรือ ✗
```

ใช้รัน: `npm run test:allocation` → 14/14 passed

---

## 5. Frontend

### 5.1 Providers & Layout

#### `frontend/components/providers/QueryProvider.tsx`

```typescript
'use client'  // ← Next.js directive: render ที่ browser เท่านั้น

QueryClient  → เก็บ cache ของทุก query
QueryClientProvider  → inject QueryClient ลง React tree ทั้งหมด
useState(() => new QueryClient())  → สร้างครั้งเดียว ไม่ re-create ตอน re-render
```

**เชื่อมกับ:** `app/layout.tsx` (wrap ทุก page), `lib/queries.ts` (ทุก hook ต้องอยู่ใน Provider)

---

#### `frontend/app/layout.tsx`

```
Root layout ที่ทุก page ถูก render ภายใน:

<html>
  <body>
    <QueryProvider>       ← React Query context
      <div className="flex">
        <Sidebar />        ← Navigation ซ้ายมือ
        <main>
          {children}       ← page content (Dashboard / Search / ShelfDetail)
        </main>
      </div>
      <Toaster />          ← sonner toast notifications (top-right)
    </QueryProvider>
  </body>
</html>
```

**เชื่อมกับ:** ทุก page, `Sidebar`, `QueryProvider`, `Toaster`

---

#### `frontend/components/Sidebar.tsx`

```
'use client'
usePathname()  → รู้ว่า active page ไหน → highlight menu item

Nav items:
  / (Dashboard)  → icon ▦
  /search        → icon ⌕

Active state: bg-zinc-700 + text-white
Inactive: text-zinc-400 + hover effect
```

**เชื่อมกับ:** `app/layout.tsx` (render ใน layout), Next.js `Link` + `usePathname`

---

### 5.2 Pages

#### `frontend/app/page.tsx` — Dashboard

```
'use client'

Hooks ที่ใช้:
  useAllocationStats()  → stat cards + category breakdown + skipped panel
  useShelves()          → shelf cards grid

State:
  showSkipped: boolean  → toggle skipped orders panel

Layout:
  ┌─────────────────────────────────────────────┐
  │ Warehouse Dashboard          [Run Allocation]│
  ├──────────┬──────────┬──────────┬────────────┤
  │ Shelves  │ Allocated│ Skipped* │ Rate %     │
  │    30    │  7,890   │  2,110   │   78%      │
  ├──────────┴──────────┴──────────┴────────────┤
  │ Allocation by Category (progress bars)       │
  ├─────────────────────────────────────────────┤
  │ [Skipped Orders Panel - toggle]             │
  ├─────────────────────────────────────────────┤
  │ SHOES — 22 shelves                          │
  │ [ShelfCard A] [ShelfCard B] [ShelfCard C]...│
  │ BAGS — 3 shelves                            │
  │ [ShelfCard LBA] [ShelfCard LBB] ...         │
  └─────────────────────────────────────────────┘

* คลิก Skipped card → toggle showSkipped panel
```

**เชื่อมกับ:** `useAllocationStats`, `useShelves`, `ShelfCard`, `RunAllocationButton`

---

#### `frontend/app/shelves/[shelfCode]/page.tsx` — Shelf Detail

```
'use client'

params: { shelfCode }  ← dynamic route parameter (e.g. "A", "LBA")
use(params)            ← React 19 unwrap Promise params

Hook:
  useShelfDetail(shelfCode)  → shelf info + grid data

Layout:
  Breadcrumb: Dashboard / Shelf A
  Header: "Shelf A" + Badge (category)
  Info bar: Levels | Slots/Level | Slot Height | Orders Allocated
  Slot Map: <SlotGrid shelf={shelf} />
```

**เชื่อมกับ:** `useShelfDetail`, `SlotGrid`, `Badge`

---

#### `frontend/app/search/page.tsx` — Search

```
'use client'

Tabs:
  Tab 1: "By Order ID"  → <SearchByOrder />
  Tab 2: "By Slot"      → <SearchBySlot />

Component: SearchByOrder
  State: input, result, error, loading
  Input: orderId (e.g. ORD00001)
  onSearch: api.get('/api/search/order/${id}')
  Result card: แสดง product info + location box

Component: SearchBySlot
  State: shelf, level, slot, result, error, loading
  3 Inputs: shelf code + level number + slot number
  onSearch: api.get('/api/search/slot?shelf=&level=&slot=')
  Result: table ของ orders ใน slot นั้น

Error handling:
  axios error → แสดง response.data.message หรือ "Not found"
```

**เชื่อมกับ:** `api.ts` (direct axios call), shadcn `Tabs`, `Input`, `Button`

---

### 5.3 Components

#### `frontend/components/ShelfCard.tsx`

```
Props: { shelf: ShelfSummary }

แสดง:
  - shelfCode (ใหญ่)
  - Badge: category (color แตกต่างตาม category)
  - Height label: "≥ 16 cm" / "< 16 cm" / "Any height"
  - Usage progress bar:
      slotsUsed / totalSlotCapacity × 100%
      สี: <60% → emerald, 60-89% → amber, ≥90% → red
  - ordersAllocated (จำนวน orders)
  - slotHeight

Behavior: ทั้ง card เป็น Link → /shelves/:shelfCode
```

---

#### `frontend/components/SlotGrid.tsx`

```
Props: { shelf: ShelfDetail }

State: hovered: { level, slot } | null

Grid:
  Level 7 (บน) → Level 1 (ล่าง)  ← แสดง 7 ลงล่าง ให้เหมือน physical shelf
  แต่ละ level: 50 slots (สี่เหลี่ยม 16×16px)

สีของ slot (ตาม fill %):
  usedHeight / slotHeight × 100%
  Empty    → zinc-100 (เทาอ่อน)
  < 50%    → emerald-300 (เขียว)
  50–89%   → amber-300 (เหลือง)
  ≥ 90%    → red-400 (แดง)

Hover:
  onMouseEnter → setHovered({ level, slot })
  → แสดง detail panel ด้านล่าง:
     "Level X · Slot Y (N items)"
     table: orderId | productName | height | price
  onMouseLeave → setHovered(null)
```

---

#### `frontend/components/RunAllocationButton.tsx`

```
'use client'

Hook: useRunAllocation() → useMutation

onClickRun:
  1. toast.loading("Running allocation algorithm...")
  2. mutate() → POST /api/allocate/run
  3. onSuccess → toast.success("Allocation complete — X allocated · Y skipped")
  4. onError   → toast.error("Allocation failed")

Disabled state: isPending=true ขณะกำลังรัน
```

**Side effect หลัง success:**
`useRunAllocation.onSuccess` → `queryClient.invalidateQueries(['allocation', 'shelves'])`
→ React Query re-fetch ทุก query ที่เกี่ยวข้อง → UI อัพเดทอัตโนมัติ

---

### 5.4 Lib

#### `frontend/lib/types.ts`

TypeScript interfaces ทั้งหมดที่ใช้ในโปรเจค:

| Interface | ใช้ที่ไหน | มาจาก API ไหน |
|-----------|----------|--------------|
| `ShelfSummary` | ShelfCard, Dashboard | `GET /api/shelves` |
| `ShelfDetail` | ShelfDetailPage, SlotGrid | `GET /api/shelves/:code` |
| `SlotItem` | SlotGrid, ShelfDetail | ภายใน ShelfDetail.grid |
| `OrderLocation` | SearchByOrder | `GET /api/search/order/:id` |
| `SlotSearch` | SearchBySlot | `GET /api/search/slot` |
| `AllocationStats` | Dashboard | `GET /api/allocate/stats` |
| `RunAllocationResult` | RunAllocationButton | `POST /api/allocate/run` |

---

#### `frontend/lib/api.ts`

```typescript
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
})
export default api
```

Axios instance กลาง — ทุก HTTP call ใช้ instance นี้
URL มาจาก `.env.local` → `NEXT_PUBLIC_API_URL=http://localhost:3001`

**ถูก import โดย:** `lib/queries.ts`, `app/search/page.tsx`

---

#### `frontend/lib/queries.ts`

React Query hooks ทั้งหมด — เป็น layer กลางระหว่าง component กับ API

| Hook | Type | Endpoint | ถูกใช้ที่ |
|------|------|----------|---------|
| `useAllocationStats()` | useQuery | GET /api/allocate/stats | Dashboard |
| `useRunAllocation()` | useMutation | POST /api/allocate/run | RunAllocationButton |
| `useShelves()` | useQuery | GET /api/shelves | Dashboard |
| `useShelfDetail(code)` | useQuery | GET /api/shelves/:code | ShelfDetailPage |
| `useSearchOrder(id)` | useQuery (manual) | GET /api/search/order/:id | SearchPage |
| `useSearchSlot(...)` | useQuery (manual) | GET /api/search/slot | SearchPage |

**Query Keys (Cache Keys):**
```
['allocation', 'stats']   → stats data
['shelves']               → shelf list
['shelves', shelfCode]    → shelf detail
['search', 'order', id]   → order search result
['search', 'slot', ...]   → slot search result
```

**Cache invalidation:**
`useRunAllocation.onSuccess` → invalidate `['allocation']` + `['shelves']`
→ force re-fetch stats และ shelf list หลัง run allocation

---

#### `frontend/lib/utils.ts`

```typescript
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
```

Helper สำหรับ merge Tailwind CSS classes — ใช้ใน shadcn/ui components

---

## 6. Dependency Map

### Backend Dependencies

```
server.ts
  └── app.ts
        ├── routes/allocate.route.ts
        │     ├── services/allocation.service.ts
        │     │     └── lib/prisma.ts → PostgreSQL
        │     └── lib/prisma.ts → PostgreSQL
        ├── routes/search.route.ts
        │     └── lib/prisma.ts → PostgreSQL
        └── routes/shelves.route.ts
              └── lib/prisma.ts → PostgreSQL

scripts/ (standalone — run via npm scripts)
  generate-orders.ts  → data/orders.csv
  seed-shelves.ts     → lib/prisma.ts → PostgreSQL
  import-orders.ts    → lib/prisma.ts → PostgreSQL
  run-allocation.ts   → services/allocation.service.ts → lib/prisma.ts
  test-allocation.ts  → (no DB — pure logic)
```

### Frontend Dependencies

```
app/layout.tsx
  ├── components/providers/QueryProvider.tsx (React Query)
  ├── components/Sidebar.tsx
  └── sonner <Toaster>

app/page.tsx (Dashboard)
  ├── lib/queries.ts: useAllocationStats()
  │     └── lib/api.ts → GET /api/allocate/stats
  ├── lib/queries.ts: useShelves()
  │     └── lib/api.ts → GET /api/shelves
  ├── components/ShelfCard.tsx
  │     └── → Link to /shelves/:shelfCode
  └── components/RunAllocationButton.tsx
        ├── lib/queries.ts: useRunAllocation()
        │     └── lib/api.ts → POST /api/allocate/run
        └── sonner toast

app/shelves/[shelfCode]/page.tsx
  ├── lib/queries.ts: useShelfDetail(code)
  │     └── lib/api.ts → GET /api/shelves/:code
  └── components/SlotGrid.tsx

app/search/page.tsx
  └── lib/api.ts (direct) → GET /api/search/order/:id
                          → GET /api/search/slot
```

---

## 7. API Reference

### Response Format (ทุก endpoint)

```json
// Success
{ "success": true, "data": { ... } }

// Error
{ "success": false, "message": "..." }
```

### Endpoints ครบ

| Method | Path | Status codes | คำอธิบาย |
|--------|------|-------------|---------|
| GET | `/api/health` | 200 | Health check |
| GET | `/api/allocate/stats` | 200 | Allocation summary + per-category + skipped list |
| POST | `/api/allocate/run` | 200 | Re-run algorithm ทั้งหมด |
| GET | `/api/search/order/:orderId` | 200, 404 | หา location ของ order |
| GET | `/api/search/slot?shelf=&level=&slot=` | 200, 400 | ดู orders ใน slot |
| GET | `/api/shelves` | 200 | ทุก shelf + usage stats |
| GET | `/api/shelves/:shelfCode` | 200, 404 | shelf detail + slot grid |

---

*อัพเดทล่าสุด: 2026-03-19*
