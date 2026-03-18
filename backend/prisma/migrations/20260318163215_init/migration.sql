-- CreateTable
CREATE TABLE "orders" (
    "id" SERIAL NOT NULL,
    "orderId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "category" TEXT NOT NULL,
    "boxHeight" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shelves" (
    "id" SERIAL NOT NULL,
    "shelfCode" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "minBoxHeight" DOUBLE PRECISION,
    "maxBoxHeight" DOUBLE PRECISION,
    "totalLevels" INTEGER NOT NULL DEFAULT 7,
    "slotHeight" DOUBLE PRECISION NOT NULL,
    "totalSlots" INTEGER NOT NULL DEFAULT 50,

    CONSTRAINT "shelves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slot_allocations" (
    "id" SERIAL NOT NULL,
    "orderId" TEXT NOT NULL,
    "shelfCode" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "slot" INTEGER NOT NULL,
    "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slot_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "orders_orderId_key" ON "orders"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "shelves_shelfCode_key" ON "shelves"("shelfCode");

-- CreateIndex
CREATE UNIQUE INDEX "slot_allocations_orderId_key" ON "slot_allocations"("orderId");

-- AddForeignKey
ALTER TABLE "slot_allocations" ADD CONSTRAINT "slot_allocations_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("orderId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slot_allocations" ADD CONSTRAINT "slot_allocations_shelfCode_fkey" FOREIGN KEY ("shelfCode") REFERENCES "shelves"("shelfCode") ON DELETE RESTRICT ON UPDATE CASCADE;
