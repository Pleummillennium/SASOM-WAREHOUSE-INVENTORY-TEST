-- CreateTable
CREATE TABLE "allocation_runs" (
    "id" SERIAL NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "allocated" INTEGER,
    "skipped" INTEGER,
    "error" TEXT,

    CONSTRAINT "allocation_runs_pkey" PRIMARY KEY ("id")
);
