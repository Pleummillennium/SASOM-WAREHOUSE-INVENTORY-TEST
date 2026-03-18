# SASOM Warehouse Inventory & Shelf Allocation System

ระบบจัดการคลังสินค้าที่จัดสรร Slot บนชั้นวางโดยอัตโนมัติตามประเภทและความสูงของสินค้า พร้อม UI สำหรับ monitor และ search

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

### 4. Setup database (migrate + seed + import)

```bash
cd backend
npm run db:setup
```

This runs in order:
1. `prisma migrate dev` — create tables
2. `generate-orders.ts` — generate 10,000 mock orders → `data/orders.csv`
3. `seed-shelves.ts` — seed 30 shelf configurations
4. `import-orders.ts` — import orders into DB

### 5. Run allocation algorithm

```bash
cd backend
npm run allocate
```

### 6. Start backend

```bash
cd backend
npm run dev     # http://localhost:3001
```

### 7. Start frontend

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

Priority order when assigning a slot:

1. **Category** must match + height condition must pass
2. **Level** 1 → 7 (bottom to top)
3. **Shelf** alphabetical (A → B → C → ...)
4. **Slot** 1 → 50

Multiple orders can share a slot as long as the cumulative `boxHeight` ≤ `slotHeight`.

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
│   │   │   ├── generate-orders.ts
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

## Available Scripts

### Backend (`cd backend`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot-reload |
| `npm run build` | Compile TypeScript |
| `npm run db:setup` | Full DB setup (migrate + generate + seed + import) |
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
