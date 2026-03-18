import fs from 'fs';
import path from 'path';
import prisma from '../lib/prisma';
const BATCH_SIZE = 500;

interface OrderRow {
  orderId: string;
  productName: string;
  price: number;
  category: string;
  boxHeight: number;
}

function parseCsv(filePath: string): OrderRow[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  const [, ...rows] = lines; // skip header

  return rows.map((line) => {
    // Handle quoted fields (productName may contain commas)
    const match = line.match(/^([^,]+),"([^"]+)",([^,]+),([^,]+),([^,]+)$/);
    if (!match) throw new Error(`Cannot parse line: ${line}`);

    const [, orderId, productName, price, category, boxHeight] = match;
    return {
      orderId: orderId.trim(),
      productName: productName.trim(),
      price: parseFloat(price),
      category: category.trim(),
      boxHeight: parseFloat(boxHeight),
    };
  });
}

async function main() {
  const csvPath = path.join(__dirname, '../../data/orders.csv');

  if (!fs.existsSync(csvPath)) {
    console.error(`Dataset not found at ${csvPath}`);
    console.error('Run: npx tsx src/scripts/generate-orders.ts first');
    process.exit(1);
  }

  console.log('Reading CSV...');
  const orders = parseCsv(csvPath);
  console.log(`Found ${orders.length} orders`);

  console.log('Clearing existing orders and allocations...');
  await prisma.slotAllocation.deleteMany();
  await prisma.order.deleteMany();

  console.log(`Importing in batches of ${BATCH_SIZE}...`);
  let imported = 0;
  for (let i = 0; i < orders.length; i += BATCH_SIZE) {
    const batch = orders.slice(i, i + BATCH_SIZE);
    await prisma.order.createMany({ data: batch });
    imported += batch.length;
    process.stdout.write(`\r  Progress: ${imported}/${orders.length}`);
  }

  console.log('\nDone!');
  console.log(`Imported ${imported} orders into DB`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
