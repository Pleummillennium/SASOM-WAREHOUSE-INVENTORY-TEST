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

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let i = 0;
  while (i <= line.length) {
    if (line[i] === '"') {
      // Quoted field — handle "" as escaped quote (RFC 4180)
      let j = i + 1;
      let value = '';
      while (j < line.length) {
        if (line[j] === '"' && line[j + 1] === '"') {
          value += '"'; // escaped quote
          j += 2;
        } else if (line[j] === '"') {
          j++; // closing quote
          break;
        } else {
          value += line[j];
          j++;
        }
      }
      fields.push(value);
      i = j + 1; // skip comma
    } else {
      // Unquoted field
      let j = i;
      while (j < line.length && line[j] !== ',') j++;
      fields.push(line.slice(i, j));
      i = j + 1;
    }
  }
  return fields;
}

function parseCsv(filePath: string): OrderRow[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  const [, ...rows] = lines; // skip header

  return rows.map((line, idx) => {
    const fields = parseCsvLine(line.trim());
    if (fields.length !== 5) throw new Error(`Line ${idx + 2}: expected 5 fields, got ${fields.length}: ${line}`);

    const [orderId, productName, price, category, boxHeight] = fields;
    return {
      orderId: orderId.trim(),
      productName: productName.trim(),
      price: parseFloat(price.replace(/"/g, '')),
      category: category.trim(),
      boxHeight: parseFloat(boxHeight.replace(/"/g, '')),
    };
  });
}

async function main() {
  const csvPath = path.join(__dirname, '../../data/ORDERS-10000-DATASET.csv');

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
