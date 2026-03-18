# Warehouse Inventory & Shelf Allocation System — Project Plan

---

## 1. สรุปโจทย์ (What the challenge wants)

ออกแบบและสร้างระบบจัดการคลังสินค้าที่สามารถ **จัดสรร Slot บนชั้นวางโดยอัตโนมัติ** ตามประเภทและความสูงของสินค้า พร้อม UI สำหรับ monitor และ search

### กฎการจัดสรร Slot (Priority Order)

1. **Category ต้องตรง** + ความสูงสะสมใน Slot ต้องไม่เกินความสูงของช่อง
2. **Level**: เริ่มจาก Level 1 (ล่างสุด) → Level 7 (บนสุด)
3. **Shelf ID**: เรียงตัวอักษร (A → B → C → ...)
4. **Slot**: เรียงตัวเลข 1 → 50

### Shelf Configuration

| Shelf | Category | เงื่อนไขความสูงสินค้า | Levels | Slot Height |
|-------|----------|-----------------------|--------|-------------|
| A – B | Shoes | ≥ 16 cm | 7 | 48 cm |
| C – V | Shoes | < 16 cm | 7 | 48 cm |
| LBA – LBC | Bags | N/A | 7 | 50 cm |
| AA – AC | Collectibles | N/A | 7 | 33 cm |
| AD – AE | Apparel | N/A | 7 | 33 cm |

### ตัวอย่าง Allocation Logic

- Shoes < 16 cm (height=12): 4 ชิ้น × 12 cm = 48 cm → เต็ม Slot → ขยับไป Slot ถัดไป
- Shoes ≥ 16 cm (height=16): 3 ชิ้น × 16 cm = 48 cm → เต็ม Slot → ขยับไป Slot ถัดไป
- เมื่อ Slot 50 เต็ม → ขึ้น Level ถัดไป | Slot 1

### สิ่งที่ต้องส่ง

| Part | รายละเอียด |
|------|-----------|
| **Backend** | JS/TS — API สำหรับ Shelf Booking + Search + Database Design |
| **Frontend** | Next.js — Monitor รายการสินค้าในแต่ละ Shelf, Search by Order ID / Slot ID |
| **README.md** | วิธีติดตั้งและทดสอบ |

---

## 2. Tech Stack ที่แนะนำ

### Architecture: Monorepo (backend + frontend แยก folder)

```
/
├── backend/    → Node.js API
└── frontend/   → Next.js App
```

### Backend

| Layer | เทคโนโลยี | เหตุผล |
|-------|-----------|--------|
| Runtime | **Node.js + TypeScript** | โจทย์บังคับ JS/TS, type-safe ลด bug |
| Framework | **Express.js** | เบา, เร็ว, ecosystem ใหญ่ |
| ORM | **Prisma** | Schema-first, migration ง่าย, type-safe query |
| Database | **PostgreSQL** | รองรับ relational data ดี, query ซับซ้อนได้ |
| Validation | **Zod** | validate request body ร่วมกับ TypeScript |

### Frontend

| Layer | เทคโนโลยี | เหตุผล |
|-------|-----------|--------|
| Framework | **Next.js 14+ (App Router)** | โจทย์บังคับ |
| Language | **TypeScript** | Type-safe, เข้ากับ Backend types |
| Styling | **Tailwind CSS** | เร็ว, flexible, ไม่ต้องเขียน CSS ยาว |
| UI Components | **shadcn/ui** | Beautiful, accessible, ใช้คู่ Tailwind |
| Data Fetching | **TanStack Query (React Query)** | Cache + refetch ง่าย |
| HTTP Client | **Axios** | สะดวกกว่า fetch สำหรับ API calls |

### DevTools

| Tool | การใช้งาน |
|------|----------|
| **Docker Compose** | รัน PostgreSQL local |
| **tsx / ts-node** | รัน TypeScript script (seed data) |
| **ESLint + Prettier** | Code quality |

---

## 3. Database Schema Design

```
orders          → เก็บข้อมูล Order จาก Dataset (10,000 rows)
shelves         → config ชั้นวาง (shelfId, category, minHeight, maxHeight, levels, slotHeight)
slot_allocations → การจอง (orderId → shelf + level + slot)
```

### ตาราง `orders`
- `id` (PK)
- `orderId` (ORD00001 ...)
- `productName`
- `price`
- `category` (shoes | bags | collectibles | apparel)
- `boxHeight` (cm)

### ตาราง `shelves`
- `id` (PK)
- `shelfCode` (A, B, C ... LBA, AA ...)
- `category`
- `minBoxHeight` (nullable)
- `maxBoxHeight` (nullable)
- `totalLevels` (7)
- `slotHeight` (cm)
- `totalSlots` (50)

### ตาราง `slot_allocations`
- `id` (PK)
- `orderId` (FK → orders)
- `shelfCode` (FK → shelves)
- `level` (1–7)
- `slot` (1–50)
- `allocatedAt`

---

## 4. API Endpoints

| Method | Path | หน้าที่ |
|--------|------|---------|
| `POST` | `/api/allocate/run` | รัน allocation algorithm บน dataset ทั้งหมด |
| `GET` | `/api/search/order/:orderId` | ค้นหาว่า Order นี้อยู่ Shelf/Level/Slot ไหน |
| `GET` | `/api/search/slot` | ค้นหาว่า Slot นี้มีของอะไร `?shelf=C&level=1&slot=1` |
| `GET` | `/api/shelves` | ดูรายการ Shelf ทั้งหมด พร้อม usage |
| `GET` | `/api/shelves/:shelfCode` | ดู Slot ทั้งหมดใน Shelf นั้น |
| `GET` | `/api/health` | Health check |

---

## 5. Task Plan (ลำดับการทำงาน)

### Phase 1 — Project Setup
- [x] **1.1** สร้างโครงสร้าง monorepo (`/backend`, `/frontend`)
- [x] **1.2** Init backend: `npm init`, TypeScript config, ESLint, Prettier
- [x] **1.3** Init frontend: `npx create-next-app` + Tailwind + shadcn/ui
- [x] **1.4** Setup Docker Compose สำหรับ PostgreSQL
- [ ] **1.5** Setup Prisma: `prisma init`, เขียน schema, รัน migration *(init + schema เสร็จแล้ว — รัน migration รอ DB up ใน Phase 2)*

### Phase 2 — Data & Seed
- [ ] **2.1** Download Orders-10000 Dataset
- [ ] **2.2** เขียน seed script สำหรับ shelf config (hardcode ตามโจทย์)
- [ ] **2.3** เขียน import script สำหรับ orders จาก CSV/JSON
- [ ] **2.4** ทดสอบว่า data ใน DB ถูกต้อง

### Phase 3 — Allocation Algorithm (Core Logic)
- [ ] **3.1** เขียน `allocationService.ts` — logic หลัก
  - เรียง order ตาม orderId (ASC)
  - แยก order ตาม category + height condition
  - จัดสรรไปยัง shelf ที่เหมาะสมตาม priority: Level → Shelf → Slot
  - track ความสูงสะสมใน Slot ปัจจุบัน
- [ ] **3.2** Unit test algorithm ด้วย mock data เล็กๆ
- [ ] **3.3** รัน allocation บน dataset จริง บันทึกผลลง `slot_allocations`

### Phase 4 — Backend API
- [ ] **4.1** Setup Express app + middleware (cors, json, error handler)
- [ ] **4.2** สร้าง route: `POST /api/allocate/run`
- [ ] **4.3** สร้าง route: `GET /api/search/order/:orderId`
- [ ] **4.4** สร้าง route: `GET /api/search/slot`
- [ ] **4.5** สร้าง route: `GET /api/shelves` และ `/api/shelves/:shelfCode`
- [ ] **4.6** ทดสอบ API ด้วย Postman หรือ curl

### Phase 5 — Frontend
- [ ] **5.1** Layout หลัก: Sidebar + Header
- [ ] **5.2** หน้า Dashboard — แสดง Shelf ทั้งหมด + usage overview
- [ ] **5.3** หน้า Shelf Detail — แสดง Slot grid ของ Shelf นั้นๆ
- [ ] **5.4** Search by Order ID — กรอก ORD00001 แล้วแสดง Shelf/Level/Slot
- [ ] **5.5** Search by Slot ID — กรอก Shelf + Level + Slot แล้วแสดงรายการสินค้า
- [ ] **5.6** เชื่อมต่อ API ทั้งหมดผ่าน React Query

### Phase 6 — Polish & Delivery
- [ ] **6.1** เขียน `README.md` (setup, env, run, test)
- [ ] **6.2** ตรวจสอบ edge cases ใน allocation (slot เต็ม, level เต็ม, ไม่มี shelf ว่าง)
- [ ] **6.3** Code cleanup + type safety check
- [ ] **6.4** ทำ final test end-to-end

---

## 6. โครงสร้าง Folder ที่แนะนำ

```
sasom-warehouse/
├── docker-compose.yml
├── README.md
│
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── allocate.route.ts
│   │   │   ├── search.route.ts
│   │   │   └── shelves.route.ts
│   │   ├── services/
│   │   │   └── allocation.service.ts   ← Core Algorithm
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   ├── scripts/
│   │   │   ├── seed-shelves.ts
│   │   │   └── import-orders.ts
│   │   └── app.ts
│   ├── package.json
│   └── tsconfig.json
│
└── frontend/
    ├── app/
    │   ├── page.tsx                    ← Dashboard
    │   ├── shelves/[shelfCode]/page.tsx
    │   └── search/page.tsx
    ├── components/
    │   ├── ShelfCard.tsx
    │   ├── SlotGrid.tsx
    │   └── SearchBar.tsx
    ├── lib/
    │   └── api.ts                      ← Axios instance
    └── package.json
```

---

## 7. สรุปแต่ละ Component ว่าทำหน้าที่อะไร

### Backend

| File/Module | หน้าที่ |
|-------------|---------|
| `allocation.service.ts` | **หัวใจของระบบ** — อ่าน orders ทั้งหมด, จัดลำดับ, คำนวณว่าแต่ละ order ควรอยู่ Shelf/Level/Slot ไหน, บันทึกลง DB |
| `allocate.route.ts` | รับ request `POST /allocate/run` → เรียก service → return summary |
| `search.route.ts` | ค้นหาตาม Order ID หรือ Slot — query `slot_allocations` join `orders` |
| `shelves.route.ts` | ดึงข้อมูล shelf config + usage statistics |
| `seed-shelves.ts` | Seed ข้อมูล shelf configuration ตามโจทย์ (hardcoded rules) ลง DB |
| `import-orders.ts` | อ่าน CSV/JSON dataset แล้ว bulk insert ลง `orders` table |
| `schema.prisma` | นิยาม Database schema ทั้งหมด |

### Frontend

| File/Component | หน้าที่ |
|----------------|---------|
| `app/page.tsx` | Dashboard หลัก — แสดง card ของแต่ละ Shelf พร้อม % การใช้งาน |
| `app/shelves/[shelfCode]/page.tsx` | Shelf detail — แสดง grid ของ Slot ทั้งหมดใน Shelf นั้น (Level × Slot) |
| `app/search/page.tsx` | หน้า search — มี 2 โหมด: by Order ID / by Slot ID |
| `ShelfCard.tsx` | UI card แสดงข้อมูล Shelf เดียว (category, levels, usage) |
| `SlotGrid.tsx` | Visual grid แสดงสถานะ Slot (ว่าง/ใช้แล้ว/เต็ม) |
| `SearchBar.tsx` | Input + dropdown เลือก search mode |
| `lib/api.ts` | Axios instance พร้อม base URL จาก env |

### Infrastructure

| File | หน้าที่ |
|------|---------|
| `docker-compose.yml` | รัน PostgreSQL container สำหรับ local dev |
| `README.md` | คู่มือ setup: clone → docker up → seed → run → test |

---

## 8. Key Algorithm (Pseudocode)

```
function allocate(orders):
  sort orders by orderId ASC

  for each order in orders:
    targetShelves = getShelvesByCategory(order.category, order.boxHeight)
    # e.g. Shoes < 16cm → [C, D, E, ..., V] sorted alphabetically

    for each shelf in targetShelves:
      for level = 1 to 7:
        for slot = 1 to 50:
          usedHeight = sum(boxHeight of orders already in [shelf, level, slot])
          if usedHeight + order.boxHeight <= shelf.slotHeight:
            assign(order → shelf, level, slot)
            break all loops

    if not assigned:
      log("No space found for order")
```

---

*สร้างเมื่อ: 2026-03-18*
