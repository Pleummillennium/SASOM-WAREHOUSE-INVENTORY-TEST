import prisma from '../lib/prisma';
import type { Shelf } from '@prisma/client';

type SlotKey = string; // `${shelfCode}|${level}|${slot}`

function slotKey(shelfCode: string, level: number, slot: number): SlotKey {
  return `${shelfCode}|${level}|${slot}`;
}

function getEligibleShelves(shelves: Shelf[], category: string, boxHeight: number): Shelf[] {
  return shelves.filter((shelf) => {
    if (shelf.category !== category) return false;
    if (shelf.minBoxHeight !== null && boxHeight < shelf.minBoxHeight) return false;
    // maxBoxHeight is an exclusive upper bound (e.g. 16 means boxHeight < 16)
    if (shelf.maxBoxHeight !== null && boxHeight >= shelf.maxBoxHeight) return false;
    return true;
  });
}

export interface AllocationResult {
  allocated: number;
  skipped: number;
  skippedOrders: string[];
}

export interface AllocationRunStatus {
  id: number;
  status: string;
  startedAt: Date;
  finishedAt: Date | null;
  allocated: number | null;
  skipped: number | null;
  error: string | null;
}

// ดึง status ของ allocation run ล่าสุด
// ใช้ใน GET /api/allocate/status เพื่อให้ frontend รู้ว่ากำลังรันอยู่หรือเปล่า
// และใช้ detect ว่า server crash กลางทางหรือเปล่า
export async function getLatestRunStatus(): Promise<AllocationRunStatus | null> {
  return prisma.allocationRun.findFirst({
    orderBy: { startedAt: 'desc' },
  });
}

export async function runAllocation(): Promise<AllocationResult> {
  // --- Edge case: ป้องกัน concurrent run ---
  // ถ้ามีใครกด Run พร้อมกัน 2 คน จะเกิด race condition ได้
  // ตรวจสอบก่อนว่ามี RUNNING อยู่แล้วหรือเปล่า
  // หมายเหตุ: ยังมี TOCTOU window เล็กๆ อยู่ (check แล้ว insert ไม่ atomic)
  // แต่สำหรับระบบนี้ที่ไม่ได้ multi-user intensive ถือว่าเพียงพอแล้ว
  const existingRun = await prisma.allocationRun.findFirst({
    where: { status: 'RUNNING' },
  });
  if (existingRun) {
    throw new Error('Allocation is already running. Please wait for it to finish.');
  }

  // สร้าง run record ก่อนเริ่ม เพื่อให้รู้ว่าเริ่มรันแล้ว
  // ถ้า server crash หลังจากนี้ record นี้จะยังอยู่ใน DB ด้วย status = RUNNING
  // ซึ่งเป็นสัญญาณให้รู้ว่ามี partial state เกิดขึ้น
  const run = await prisma.allocationRun.create({
    data: { status: 'RUNNING' },
  });

  try {
    const shelves = await prisma.shelf.findMany({ orderBy: { shelfCode: 'asc' } });
    const orders = await prisma.order.findMany({ orderBy: { orderId: 'asc' } });

    // In-memory tracker: slotKey → accumulated height (cm)
    const usedHeight = new Map<SlotKey, number>();

    const getUsed = (shelfCode: string, level: number, slot: number): number =>
      usedHeight.get(slotKey(shelfCode, level, slot)) ?? 0;

    const addUsed = (shelfCode: string, level: number, slot: number, height: number): void => {
      const key = slotKey(shelfCode, level, slot);
      usedHeight.set(key, (usedHeight.get(key) ?? 0) + height);
    };

    const allocations: { orderId: string; shelfCode: string; level: number; slot: number }[] = [];
    const skippedOrders: string[] = [];

    for (const order of orders) {
      const eligible = getEligibleShelves(shelves, order.category, order.boxHeight);
      let assigned = false;

      // Priority: Level 1→7, then Shelf (alphabetical), then Slot 1→50
      outer: for (let level = 1; level <= 7; level++) {
        for (const shelf of eligible) {
          for (let slot = 1; slot <= shelf.totalSlots; slot++) {
            if (getUsed(shelf.shelfCode, level, slot) + order.boxHeight <= shelf.slotHeight) {
              addUsed(shelf.shelfCode, level, slot, order.boxHeight);
              allocations.push({ orderId: order.orderId, shelfCode: shelf.shelfCode, level, slot });
              assigned = true;
              break outer;
            }
          }
        }
      }

      if (!assigned) {
        skippedOrders.push(order.orderId);
      }
    }

    // --- Edge case: Atomicity ของการ write ลง DB ---
    // ปัญหาเดิม: deleteMany() + createMany() หลายรอบเป็น DB call แยกกัน
    // ถ้า server ตายระหว่าง batch insert จะเหลือข้อมูลครึ่งเดียวใน DB
    // โดยไม่มีทางรู้ว่า allocation ที่เห็นนั้น complete หรือ partial
    //
    // แก้ด้วย: ห่อทุกอย่างใน $transaction เดียว
    // ถ้า crash กลางทาง = Postgres rollback ทั้งหมดอัตโนมัติ
    // ผลคือ DB จะอยู่ใน state เดิมก่อนรัน (allocation เก่ายังอยู่ครบ)
    // แทนที่จะเป็น partial state ที่ข้อมูลไม่สมบูรณ์
    //
    // timeout: 60s เพราะ default ของ Prisma interactive transaction คือ 5s
    // ซึ่งไม่พอสำหรับ batch insert จำนวนมาก
    const BATCH = 500;
    await prisma.$transaction(
      async (tx) => {
        // ลบ allocation เก่าทั้งหมดก่อน
        // อยู่ใน transaction เดียวกัน ดังนั้น delete + insert จะ atomic
        // ไม่มีช่วงที่ DB ว่างเปล่า (ถ้า crash ระหว่างนี้ = rollback กลับไปมี allocation เดิม)
        await tx.slotAllocation.deleteMany();

        for (let i = 0; i < allocations.length; i += BATCH) {
          await tx.slotAllocation.createMany({ data: allocations.slice(i, i + BATCH) });
        }
      },
      { timeout: 60_000 },
    );

    // อัปเดต run record เป็น DONE พร้อม result
    await prisma.allocationRun.update({
      where: { id: run.id },
      data: {
        status: 'DONE',
        finishedAt: new Date(),
        allocated: allocations.length,
        skipped: skippedOrders.length,
      },
    });

    return { allocated: allocations.length, skipped: skippedOrders.length, skippedOrders };
  } catch (err) {
    // --- Edge case: ถ้าเกิด error ใดๆ ระหว่างรัน ---
    // อัปเดต status เป็น FAILED พร้อมเก็บ error message ไว้
    // ให้ frontend แสดง error ให้ user รู้ว่าเกิดอะไรขึ้น
    // และรู้ว่าต้องกด Run ใหม่ (ข้อมูลปลอดภัยเพราะ transaction rollback แล้ว)
    const message = err instanceof Error ? err.message : 'Unknown error';
    await prisma.allocationRun
      .update({
        where: { id: run.id },
        data: { status: 'FAILED', finishedAt: new Date(), error: message },
      })
      .catch(() => {
        // ถ้า DB ตายด้วย (ไม่ใช่แค่ server crash) update ตรงนี้จะ fail
        // ไม่ต้อง throw ซ้อน เพราะ error ตัวจริงอยู่ใน err ด้านล่างแล้ว
      });

    throw err;
  }
}
