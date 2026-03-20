/**
 * Unit test สำหรับ allocation logic ด้วย mock data
 * ไม่ใช้ DB — test pure logic แยกออกมา
 */

import type { Shelf } from '@prisma/client';

// ---- replicate core logic ----

type SlotKey = string;
function slotKey(s: string, l: number, slot: number): SlotKey {
  return `${s}|${l}|${slot}`;
}

function getEligibleShelves(shelves: Shelf[], category: string, boxHeight: number): Shelf[] {
  return shelves.filter((shelf) => {
    if (shelf.category !== category) return false;
    if (shelf.minBoxHeight !== null && boxHeight < shelf.minBoxHeight) return false;
    if (shelf.maxBoxHeight !== null && boxHeight >= shelf.maxBoxHeight) return false;
    return true;
  });
}

function allocate(
  orders: { orderId: string; category: string; boxHeight: number }[],
  shelves: Shelf[],
) {
  const usedHeight = new Map<SlotKey, number>();
  const getUsed = (s: string, l: number, slot: number) =>
    usedHeight.get(slotKey(s, l, slot)) ?? 0;
  const addUsed = (s: string, l: number, slot: number, h: number) => {
    const k = slotKey(s, l, slot);
    usedHeight.set(k, (usedHeight.get(k) ?? 0) + h);
  };

  const results: { orderId: string; shelfCode: string; level: number; slot: number }[] = [];
  const skipped: string[] = [];

  for (const order of orders) {
    const eligible = getEligibleShelves(shelves, order.category, order.boxHeight);
    let assigned = false;

    outer: for (let level = 1; level <= 7; level++) {
      for (const shelf of eligible) {
        for (let slot = 1; slot <= shelf.totalSlots; slot++) {
          if (getUsed(shelf.shelfCode, level, slot) + order.boxHeight <= shelf.slotHeight) {
            addUsed(shelf.shelfCode, level, slot, order.boxHeight);
            results.push({ orderId: order.orderId, shelfCode: shelf.shelfCode, level, slot });
            assigned = true;
            break outer;
          }
        }
      }
    }

    if (!assigned) skipped.push(order.orderId);
  }

  return { results, skipped };
}

// ---- mock data ----

function makeShelf(
  shelfCode: string,
  category: string,
  minBoxHeight: number | null,
  maxBoxHeight: number | null,
  slotHeight: number,
): Shelf {
  return {
    id: 0,
    shelfCode,
    category,
    minBoxHeight,
    maxBoxHeight,
    totalLevels: 7,
    slotHeight,
    totalSlots: 50,
  };
}

const mockShelves: Shelf[] = [
  makeShelf('A', 'shoes', 16, null, 48),   // shoes ≥16
  makeShelf('B', 'shoes', 16, null, 48),
  makeShelf('C', 'shoes', null, 16, 48),   // shoes <16 (exclusive upper bound)
  makeShelf('LBA', 'bags', null, null, 50),
];

// ---- tests ----

let passed = 0;
let failed = 0;

function assert(name: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

console.log('\n=== Test: Shoes ≥16 cm → Shelf A ===');
{
  const orders = [{ orderId: 'ORD00001', category: 'shoes', boxHeight: 16 }];
  const { results } = allocate(orders, mockShelves);
  assert('assigned to shelf A', results[0]?.shelfCode === 'A');
  assert('level 1', results[0]?.level === 1);
  assert('slot 1', results[0]?.slot === 1);
}

console.log('\n=== Test: Shoes <16 cm → Shelf C ===');
{
  const orders = [{ orderId: 'ORD00001', category: 'shoes', boxHeight: 12 }];
  const { results } = allocate(orders, mockShelves);
  assert('assigned to shelf C', results[0]?.shelfCode === 'C');
}

console.log('\n=== Test: Slot fills up then moves to next slot ===');
{
  // slotHeight=48, each box=16 → 3 fit per slot
  const orders = [
    { orderId: 'ORD00001', category: 'shoes', boxHeight: 16 },
    { orderId: 'ORD00002', category: 'shoes', boxHeight: 16 },
    { orderId: 'ORD00003', category: 'shoes', boxHeight: 16 },
    { orderId: 'ORD00004', category: 'shoes', boxHeight: 16 }, // should go to slot 2
  ];
  const { results } = allocate(orders, mockShelves);
  assert('first 3 in slot 1', results[0].slot === 1 && results[1].slot === 1 && results[2].slot === 1);
  assert('4th moves to slot 2', results[3]?.slot === 2);
}

console.log('\n=== Test: Bags go to LBA ===');
{
  const orders = [{ orderId: 'ORD00001', category: 'bags', boxHeight: 30 }];
  const { results } = allocate(orders, mockShelves);
  assert('assigned to LBA', results[0]?.shelfCode === 'LBA');
}

console.log('\n=== Test: Order too tall → skipped ===');
{
  // bag slotHeight=50, box=51 → no fit
  const orders = [{ orderId: 'ORD00001', category: 'bags', boxHeight: 51 }];
  const { results, skipped } = allocate(orders, mockShelves);
  assert('not assigned', results.length === 0);
  assert('in skipped list', skipped.includes('ORD00001'));
}

console.log('\n=== Test: Level fills up → moves to next level ===');
{
  // slots=50, slotHeight=48, boxHeight=48 → 1 per slot
  // Level 1 has 50 slots → 50 orders fill it, 51st goes to level 2
  const orders = Array.from({ length: 51 }, (_, i) => ({
    orderId: `ORD${String(i + 1).padStart(5, '0')}`,
    category: 'shoes',
    boxHeight: 48,
  }));
  const { results } = allocate(orders, [makeShelf('A', 'shoes', 16, null, 48)]);
  assert('first 50 on level 1', results.slice(0, 50).every((r) => r.level === 1));
  assert('51st on level 2', results[50]?.level === 2);
}

console.log('\n=== Test: orderId sort — ORD00001 gets first slot ===');
{
  // orders are already passed in order, but let's verify
  const orders = [
    { orderId: 'ORD00003', category: 'shoes', boxHeight: 16 },
    { orderId: 'ORD00001', category: 'shoes', boxHeight: 16 },
    { orderId: 'ORD00002', category: 'shoes', boxHeight: 16 },
  ];
  // sort by orderId before allocating (mimics service behavior)
  orders.sort((a, b) => a.orderId.localeCompare(b.orderId));
  const { results } = allocate(orders, mockShelves);
  assert('ORD00001 gets slot 1', results.find((r) => r.orderId === 'ORD00001')?.slot === 1);
  assert('ORD00002 gets slot 1 (stacked)', results.find((r) => r.orderId === 'ORD00002')?.slot === 1);
  assert('ORD00003 gets slot 1 (stacked)', results.find((r) => r.orderId === 'ORD00003')?.slot === 1);
}

console.log(`\n${'─'.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
