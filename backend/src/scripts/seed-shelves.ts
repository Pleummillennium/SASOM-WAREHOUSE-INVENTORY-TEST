import prisma from '../lib/prisma';

interface ShelfConfig {
  shelfCode: string;
  category: string;
  minBoxHeight: number | null;
  maxBoxHeight: number | null;
  totalLevels: number;
  slotHeight: number;
  totalSlots: number;
}

function generateShelfCodes(start: string, end: string): string[] {
  const codes: string[] = [];
  let current = start.charCodeAt(0);
  const last = end.charCodeAt(0);
  while (current <= last) {
    codes.push(String.fromCharCode(current));
    current++;
  }
  return codes;
}

function generateLbaCodes(): string[] {
  return ['LBA', 'LBB', 'LBC'];
}

function generateAaCodes(start: string, end: string): string[] {
  // AA, AB, AC, AD, AE
  const codes: string[] = [];
  const startCode = start.charCodeAt(1);
  const endCode = end.charCodeAt(1);
  for (let i = startCode; i <= endCode; i++) {
    codes.push('A' + String.fromCharCode(i));
  }
  return codes;
}

async function main() {
  console.log('Seeding shelves...');

  const shelves: ShelfConfig[] = [];

  // Shoes ≥ 16 cm → Shelf A, B
  for (const code of generateShelfCodes('A', 'B')) {
    shelves.push({
      shelfCode: code,
      category: 'shoes',
      minBoxHeight: 16,
      maxBoxHeight: null,
      totalLevels: 7,
      slotHeight: 48,
      totalSlots: 50,
    });
  }

  // Shoes < 16 cm → Shelf C–V
  for (const code of generateShelfCodes('C', 'V')) {
    shelves.push({
      shelfCode: code,
      category: 'shoes',
      minBoxHeight: null,
      maxBoxHeight: 15,
      totalLevels: 7,
      slotHeight: 48,
      totalSlots: 50,
    });
  }

  // Bags → LBA–LBC
  for (const code of generateLbaCodes()) {
    shelves.push({
      shelfCode: code,
      category: 'bags',
      minBoxHeight: null,
      maxBoxHeight: null,
      totalLevels: 7,
      slotHeight: 50,
      totalSlots: 50,
    });
  }

  // Collectibles → AA–AC
  for (const code of generateAaCodes('AA', 'AC')) {
    shelves.push({
      shelfCode: code,
      category: 'collectibles',
      minBoxHeight: null,
      maxBoxHeight: null,
      totalLevels: 7,
      slotHeight: 33,
      totalSlots: 50,
    });
  }

  // Apparel → AD–AE
  for (const code of generateAaCodes('AD', 'AE')) {
    shelves.push({
      shelfCode: code,
      category: 'apparel',
      minBoxHeight: null,
      maxBoxHeight: null,
      totalLevels: 7,
      slotHeight: 33,
      totalSlots: 50,
    });
  }

  await prisma.shelf.deleteMany();
  await prisma.shelf.createMany({ data: shelves });

  console.log(`Seeded ${shelves.length} shelves:`);
  const grouped: Record<string, number> = {};
  for (const s of shelves) {
    grouped[s.category] = (grouped[s.category] ?? 0) + 1;
  }
  for (const [cat, count] of Object.entries(grouped)) {
    console.log(`  ${cat}: ${count} shelves`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
