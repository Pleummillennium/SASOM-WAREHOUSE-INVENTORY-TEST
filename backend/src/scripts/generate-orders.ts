import fs from 'fs';
import path from 'path';

const TOTAL_ORDERS = 10000;

const SHOE_NAMES_TALL = [
  'Nike Air Max 270', 'Adidas Ultraboost 22', 'Jordan 1 Retro High',
  'New Balance 574', 'Vans Old Skool High', 'Converse Chuck Taylor High',
  'Puma RS-X', 'Reebok Classic Leather', 'Salomon XT-6', 'Hoka Clifton 9',
];

const SHOE_NAMES_SHORT = [
  'Nike Air Force 1 Low', 'Adidas Stan Smith', 'Vans Slip-On',
  'Converse Chuck Taylor Low', 'Puma Suede Classic', 'Reebok Club C',
  'New Balance 990', 'Common Projects Achilles', 'Onitsuka Tiger Mexico 66',
  'Skechers Go Walk', 'Crocs Classic Clog', 'Birkenstock Arizona',
];

const BAG_NAMES = [
  'Louis Vuitton Neverfull', 'Gucci GG Marmont', 'Chanel Classic Flap',
  'Coach Tabby', 'Kate Spade New York Bag', 'Tumi Alpha Backpack',
  'Fjällräven Kånken', 'Longchamp Le Pliage', 'Prada Nylon Bag',
  'MCM Stark Backpack', 'Samsonite Spinner', 'Kipling City Bag',
];

const COLLECTIBLE_NAMES = [
  'Bearbrick 400%', 'Funko Pop Batman', 'Hot Wheels RLC',
  'LEGO Creator Expert', 'Gundam RX-78-2 MG', 'Tamiya RC Car',
  'Bandai Ultraman Figure', 'Nendoroid Hatsune Miku', 'Dragon Ball Statue',
  'One Piece Mega WCF', 'Figma Link', 'McFarlane Spawn Figure',
];

const APPAREL_NAMES = [
  'Supreme Box Logo Tee', 'Off-White Arrows Hoodie', 'Palace Tri-Ferg Tee',
  'Stüssy World Tour Tee', 'A Bathing Ape Shark Hoodie', 'Fear of God Essentials',
  'Carhartt WIP Chase Tee', 'Comme des Garçons Shirt', 'Acne Studios Face Patch',
  'Stone Island Shadow Project', 'Noah Core Logo Tee', 'Kith Box Logo',
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals = 2): number {
  const val = Math.random() * (max - min) + min;
  return parseFloat(val.toFixed(decimals));
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

interface Order {
  orderId: string;
  productName: string;
  price: number;
  category: string;
  boxHeight: number;
}

function generateOrders(): Order[] {
  const orders: Order[] = [];

  // Distribution: shoes 40%, bags 20%, collectibles 20%, apparel 20%
  const distribution = [
    { category: 'shoes-tall', count: 2000 },
    { category: 'shoes-short', count: 2000 },
    { category: 'bags', count: 2000 },
    { category: 'collectibles', count: 2000 },
    { category: 'apparel', count: 2000 },
  ];

  const rawOrders: Omit<Order, 'orderId'>[] = [];

  for (const { category, count } of distribution) {
    for (let i = 0; i < count; i++) {
      if (category === 'shoes-tall') {
        rawOrders.push({
          productName: pick(SHOE_NAMES_TALL),
          price: randomFloat(1500, 25000),
          category: 'shoes',
          boxHeight: randomInt(16, 40),
        });
      } else if (category === 'shoes-short') {
        rawOrders.push({
          productName: pick(SHOE_NAMES_SHORT),
          price: randomFloat(500, 15000),
          category: 'shoes',
          boxHeight: randomInt(5, 15),
        });
      } else if (category === 'bags') {
        rawOrders.push({
          productName: pick(BAG_NAMES),
          price: randomFloat(800, 80000),
          category: 'bags',
          boxHeight: randomInt(10, 49),
        });
      } else if (category === 'collectibles') {
        rawOrders.push({
          productName: pick(COLLECTIBLE_NAMES),
          price: randomFloat(300, 15000),
          category: 'collectibles',
          boxHeight: randomInt(5, 32),
        });
      } else {
        rawOrders.push({
          productName: pick(APPAREL_NAMES),
          price: randomFloat(500, 30000),
          category: 'apparel',
          boxHeight: randomInt(5, 32),
        });
      }
    }
  }

  // Shuffle then assign orderId
  for (let i = rawOrders.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rawOrders[i], rawOrders[j]] = [rawOrders[j], rawOrders[i]];
  }

  for (let i = 0; i < TOTAL_ORDERS; i++) {
    orders.push({
      orderId: `ORD${String(i + 1).padStart(5, '0')}`,
      ...rawOrders[i],
    });
  }

  return orders;
}

const orders = generateOrders();

// Write CSV
const csvHeader = 'orderId,productName,price,category,boxHeight\n';
const csvRows = orders
  .map((o) => `${o.orderId},"${o.productName}",${o.price},${o.category},${o.boxHeight}`)
  .join('\n');

const outputPath = path.join(__dirname, '../../data/orders.csv');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, csvHeader + csvRows, 'utf-8');

console.log(`Generated ${orders.length} orders → ${outputPath}`);
