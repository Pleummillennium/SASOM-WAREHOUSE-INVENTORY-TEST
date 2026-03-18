import { runAllocation } from '../services/allocation.service';

async function main() {
  console.log('Running allocation on full dataset...');
  const start = Date.now();

  const result = await runAllocation();

  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  console.log(`\nDone in ${elapsed}s`);
  console.log(`  Allocated : ${result.allocated}`);
  console.log(`  Skipped   : ${result.skipped}`);

  if (result.skippedOrders.length > 0) {
    console.log(`  Skipped orders: ${result.skippedOrders.slice(0, 10).join(', ')}${result.skippedOrders.length > 10 ? '...' : ''}`);
  }
}

main().catch(console.error);
