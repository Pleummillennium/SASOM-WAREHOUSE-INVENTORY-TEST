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

function parseCsv(filePath: string): { rows: OrderRow[]; errors: string[] } {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  const [, ...rawRows] = lines; // skip header

  const rows: OrderRow[] = [];
  const errors: string[] = [];

  for (let idx = 0; idx < rawRows.length; idx++) {
    const lineNum = idx + 2; // +2 เพราะ header อยู่ที่ row 1
    const line = rawRows[idx].trim();

    // ข้าม blank line แทนที่จะ throw — CSV บางไฟล์มี trailing newline
    if (!line) continue;

    const fields = parseCsvLine(line);

    // --- Validation: จำนวน column ---
    // ตรวจก่อน destructure เพื่อไม่ให้ได้ undefined แล้วค่อยไป error ที่อื่น
    if (fields.length !== 5) {
      errors.push(`Row ${lineNum}: expected 5 columns, got ${fields.length}`);
      continue; // เก็บ error แล้วข้ามไป row ถัดไป ไม่หยุดทันที
    }

    const [orderId, productName, priceRaw, category, boxHeightRaw] = fields;
    const price = parseFloat(priceRaw.replace(/"/g, ''));
    const boxHeight = parseFloat(boxHeightRaw.replace(/"/g, ''));

    // --- Validation: เก็บทุก error ของ row นี้ก่อน ---
    // ไม่ throw ทีละ error เพราะ user จะต้องแก้แล้ว run ใหม่ทีละครั้ง
    // เก็บไว้ทั้งหมดแล้ว report พร้อมกันตอนจบ
    const rowErrors: string[] = [];

    if (!orderId.trim()) {
      rowErrors.push('orderId is empty');
    }

    if (!productName.trim()) {
      rowErrors.push('productName is empty');
    }

    if (!category.trim()) {
      rowErrors.push('category is empty');
    }

    if (isNaN(price)) {
      // parseFloat คืน NaN ถ้า string parse ไม่ได้ เช่น "abc", ""
      rowErrors.push(`price is not a valid number: "${priceRaw.trim()}"`);
    } else if (price < 0) {
      rowErrors.push(`price must be >= 0, got ${price}`);
    }

    if (isNaN(boxHeight)) {
      rowErrors.push(`boxHeight is not a valid number: "${boxHeightRaw.trim()}"`);
    } else if (boxHeight <= 0) {
      // boxHeight <= 0 ทำให้ allocation logic พัง:
      // negative → usedHeight ของ slot ลดลง ทำให้ slot รับของได้ไม่จำกัด
      // zero → order ไม่มีขนาด ไม่สมเหตุสมผลทางธุรกิจ
      rowErrors.push(`boxHeight must be > 0, got ${boxHeight}`);
    }

    if (rowErrors.length > 0) {
      errors.push(`Row ${lineNum}: ${rowErrors.join(', ')}`);
      continue;
    }

    rows.push({
      orderId: orderId.trim(),
      productName: productName.trim(),
      price,
      category: category.trim(),
      boxHeight,
    });
  }

  return { rows, errors };
}

async function main() {
  const csvPath = path.join(__dirname, '../../data/ORDERS-10000-DATASET.csv');

  if (!fs.existsSync(csvPath)) {
    console.error(`Dataset not found at ${csvPath}`);
    console.error('Please provide the CSV dataset at the expected path.');
    process.exit(1);
  }

  console.log('Reading and validating CSV...');
  const { rows, errors } = parseCsv(csvPath);

  // --- หยุดก่อนแตะ DB ถ้ามี validation error ---
  // เดิม: deleteMany() อยู่ก่อน parseCsv() ทำให้ถ้า parse พัง data หายหมด
  // ตอนนี้: parse + validate ก่อนเสมอ ถ้าไม่ผ่านไม่แตะ DB เลย
  if (errors.length > 0) {
    console.error(`\nFound ${errors.length} validation error(s):\n`);
    errors.forEach((e) => console.error(`  ${e}`));
    console.error('\nImport aborted. Fix the errors above and try again.');
    process.exit(1);
  }

  console.log(`Parsed ${rows.length} valid orders`);

  // --- ห่อ delete + insert ใน transaction เดียวกัน ---
  // ถ้า batch ใด batch หนึ่ง fail (เช่น orderId ซ้ำ) จะ rollback ทั้งหมด
  // ไม่มี partial state — DB จะอยู่ใน state เดิมก่อน import
  console.log('Importing...');
  let imported = 0;
  await prisma.$transaction(
    async (tx) => {
      await tx.slotAllocation.deleteMany();
      await tx.order.deleteMany();

      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        await tx.order.createMany({ data: batch });
        imported += batch.length;
        process.stdout.write(`\r  Progress: ${imported}/${rows.length}`);
      }
    },
    { timeout: 60_000 },
  );

  console.log('\nDone!');
  console.log(`Imported ${imported} orders into DB`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
