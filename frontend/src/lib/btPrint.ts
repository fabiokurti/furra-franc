import type { Client, Delivery, ShopSale } from '@/types';
import { formatDateAL } from './date';

// ── ESC/POS constants ──────────────────────────────────────────────────────
const ESC = 0x1b, GS = 0x1d;

const BLE_SERVICES = [
  { svc: '000018f0-0000-1000-8000-00805f9b34fb', chr: '00002af1-0000-1000-8000-00805f9b34fb' },
  { svc: '49535343-fe7d-4ae5-8fa9-9fafd205e455', chr: '49535343-8841-43f4-a8d4-ecbe34729bb3' },
  { svc: 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', chr: 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f' },
];

const W = 42;

const enc  = (s: string)    => new TextEncoder().encode(s);
const cmd  = (...b: number[]) => new Uint8Array(b);
const row  = (s: string)    => enc(safe(s) + '\n');
const nl   = ()             => enc('\n');
const sep  = (c = '-')      => enc(c.repeat(W) + '\n');

function safe(s: string) {
  return s.replace(/ë/g, 'e').replace(/Ë/g, 'E').replace(/ç/g, 'c').replace(/Ç/g, 'C');
}

function lr(left: string, right: string): Uint8Array {
  left  = safe(left).substring(0, W - right.length - 1);
  right = safe(right);
  return enc(left + ' '.repeat(Math.max(1, W - left.length - right.length)) + right + '\n');
}

function merge(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function bleWrite(char: any, data: Uint8Array) {
  for (let i = 0; i < data.length; i += 100) {
    await char.writeValue(data.slice(i, i + 100));
    await new Promise((r) => setTimeout(r, 30));
  }
}

function buildReceipt(
  delivery: Delivery & { totalPrice?: number },
  priceMap: Record<string, number>,
): Uint8Array {
  const date = formatDateAL(delivery.deliveryDate, true);
  const now  = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // Per-item lines: two rows each — name, then qty × price = total
  const itemParts: Uint8Array[] = [];
  let calcTotal = 0;
  for (const item of delivery.items) {
    const price        = priceMap[item.productId] ?? 0;
    const returnedQty   = item.returnedQuantity ?? 0;
    const effectiveQty  = item.quantity - returnedQty;
    const lineTotal     = effectiveQty * price;
    calcTotal += lineTotal;
    itemParts.push(
      row(item.product.name),
      lr(`  ${item.quantity} x ${price} L`, `${lineTotal} L`),
      ...(returnedQty > 0 ? [row(`  (Kthyer ${returnedQty} -> neto ${effectiveQty})`)] : []),
    );
  }
  const total = calcTotal > 0 ? calcTotal : (delivery.totalPrice ?? 0);
  const hasReturns = delivery.items.some((i) => (i.returnedQuantity ?? 0) > 0);

  return merge(
    cmd(ESC, 0x40),
    cmd(ESC, 0x61, 0x01), cmd(GS, 0x21, 0x11), cmd(ESC, 0x45, 0x01),
    row('FURRA FRANC'),
    cmd(GS, 0x21, 0x00),
    row('Preventiv Dergese'),
    cmd(ESC, 0x45, 0x00),
    row(delivery.isPaid ? '[ PAGUAR ]' : '[ PA PAGUAR ]'),
    nl(),
    sep('='),
    cmd(ESC, 0x61, 0x00),
    row(`Data: ${date}`),
    row(`Ora:  ${time}`),
    sep(),
    cmd(ESC, 0x45, 0x01), row(`Klienti: ${delivery.client.name}`), cmd(ESC, 0x45, 0x00),
    ...(delivery.client.address ? [row(`Adresa:  ${delivery.client.address}`)] : []),
    ...(delivery.client.phone   ? [row(`Tel:     ${delivery.client.phone}`)]   : []),
    row(`Shpern.: ${delivery.createdBy.name}`),
    sep(),
    lr('Produkti', 'Total'),
    sep(),
    ...itemParts,
    sep(),
    ...(hasReturns ? [row('Totali eshte pas zbritjes se kthimeve')] : []),
    cmd(ESC, 0x45, 0x01), cmd(GS, 0x21, 0x11),
    lr('TOTALI:', `${total.toFixed(0)} L`),
    cmd(GS, 0x21, 0x00), cmd(ESC, 0x45, 0x00),
    ...(delivery.notes ? [sep(), row(`Note: ${delivery.notes}`)] : []),
    sep('='),
    cmd(ESC, 0x61, 0x01),
    row('Furra Franc - Faleminderit!'),
    cmd(ESC, 0x64, 0x08),
    cmd(GS, 0x56, 0x42, 0x00),
  );
}

// ── Image (raster) receipt: renders the styled design and prints it as a
//    bitmap so the thermal printer shows the real layout, not just text ──────
const PRINTER_DOTS = 576; // 80mm print head width in dots (lower to 384 if cut off)

function moneyImg(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' L';
}

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function hline(ctx: CanvasRenderingContext2D, x1: number, x2: number, y: number, w = 1, dashed = false) {
  ctx.lineWidth = w;
  if (dashed) ctx.setLineDash([5, 4]);
  ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
  ctx.setLineDash([]); ctx.lineWidth = 1;
}

function clipText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number) {
  if (ctx.measureText(text).width <= maxW) { ctx.fillText(text, x, y); return; }
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  ctx.fillText(t + '…', x, y);
}

function renderReceiptCanvas(
  delivery: Delivery & { totalPrice?: number },
  priceMap: Record<string, number>,
): { canvas: HTMLCanvasElement; height: number } {
  const W = PRINTER_DOTS;
  const PAD = 18;
  const cw = W - PAD * 2;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = 2600;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { canvas, height: 0 };
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, canvas.height);
  ctx.fillStyle = '#000'; ctx.strokeStyle = '#000'; ctx.textBaseline = 'top';

  const date = formatDateAL(delivery.deliveryDate, true);
  const now  = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // top bar
  ctx.fillRect(0, 0, W, 12);
  let y = 34;

  // brand + paid pill
  ctx.textAlign = 'left'; ctx.font = '800 46px Arial';
  ctx.fillText('Furra Franc', PAD, y);
  const paid = delivery.isPaid;
  const pillText = paid ? 'PAGUAR' : 'PA PAGUAR';
  ctx.font = 'bold 20px Arial';
  const pillW = ctx.measureText(pillText).width + 26;
  const pillH = 34, pillX = W - PAD - pillW, pillY = y + 6;
  ctx.lineWidth = 2; rrect(ctx, pillX, pillY, pillW, pillH, 17);
  if (paid) { ctx.fill(); ctx.fillStyle = '#fff'; } else { ctx.stroke(); }
  ctx.textAlign = 'center'; ctx.fillText(pillText, pillX + pillW / 2, pillY + 8);
  ctx.fillStyle = '#000'; ctx.textAlign = 'left';
  y += 52;
  ctx.font = 'bold 18px Arial'; ctx.fillText('PREVENTIV DËRGESE', PAD, y);
  y += 30;
  hline(ctx, PAD, W - PAD, y); y += 18;

  // meta grid (2 columns)
  const c2 = PAD + cw / 2;
  const meta = (l1: string, v1: string, l2: string, v2: string) => {
    ctx.textAlign = 'left'; ctx.font = 'bold 15px Arial';
    ctx.fillText(l1, PAD, y); ctx.fillText(l2, c2, y);
    ctx.font = 'bold 25px Arial';
    clipText(ctx, v1, PAD, y + 18, cw / 2 - 14);
    clipText(ctx, v2, c2, y + 18, W - PAD - c2);
    y += 52;
  };
  meta('DATA', date, 'ORA', time);
  meta('KLIENTI', delivery.client.name, 'SHPËRNDARËSI', delivery.createdBy.name);
  y += 4; hline(ctx, PAD, W - PAD, y); y += 16;

  // table columns
  const xName = PAD, xQty = PAD + cw * 0.52, xRet = PAD + cw * 0.66,
        xPrice = W - PAD - cw * 0.17, xTotal = W - PAD;
  ctx.font = 'bold 15px Arial';
  ctx.textAlign = 'left';   ctx.fillText('PRODUKTI', xName, y);
  ctx.textAlign = 'center'; ctx.fillText('SASIA', xQty, y);
  ctx.textAlign = 'center'; ctx.fillText('KTHYER', xRet, y);
  ctx.textAlign = 'right';  ctx.fillText('ÇMIMI', xPrice, y);
  ctx.textAlign = 'right';  ctx.fillText('TOTALI', xTotal, y);
  y += 22; hline(ctx, PAD, W - PAD, y, 3); y += 12;

  // rows
  let calcTotal = 0;
  for (const item of delivery.items) {
    const price = priceMap[item.productId] ?? 0;
    const ret   = item.returnedQuantity ?? 0;
    const eff   = item.quantity - ret;
    const line  = eff * price;
    calcTotal += line;
    ctx.textAlign = 'left'; ctx.font = 'bold 24px Arial';
    clipText(ctx, item.product.name, xName, y, cw * 0.48);
    ctx.font = '24px Arial'; ctx.textAlign = 'center';
    ctx.fillText(String(item.quantity), xQty, y);
    if (ret > 0) {
      ctx.font = 'bold 20px Arial';
      const bt = String(ret), bw = ctx.measureText(bt).width + 18;
      ctx.lineWidth = 2; rrect(ctx, xRet - bw / 2, y - 3, bw, 30, 6); ctx.stroke();
      ctx.textAlign = 'center'; ctx.fillText(bt, xRet, y + 1);
    } else {
      ctx.textAlign = 'center'; ctx.font = '24px Arial'; ctx.fillText('—', xRet, y);
    }
    ctx.font = '24px Arial'; ctx.textAlign = 'right'; ctx.fillText(moneyImg(price), xPrice, y);
    ctx.font = 'bold 24px Arial'; ctx.fillText(moneyImg(line), xTotal, y);
    y += 38; hline(ctx, PAD, W - PAD, y - 6, 1, true);
  }
  const total = calcTotal > 0 ? calcTotal : (delivery.totalPrice ?? 0);

  // total
  y += 6; hline(ctx, PAD, W - PAD, y, 3); y += 14;
  ctx.textAlign = 'left';  ctx.font = 'bold 24px Arial';  ctx.fillText('TOTALI (pas kthimeve)', xName, y);
  ctx.textAlign = 'right'; ctx.font = '800 34px Arial';   ctx.fillText(moneyImg(total), xTotal, y - 6);
  y += 48;

  // note
  if (delivery.notes) {
    ctx.fillRect(PAD, y, 5, 38);
    ctx.textAlign = 'left'; ctx.font = 'italic 20px Arial';
    clipText(ctx, 'Shënim: ' + delivery.notes, PAD + 14, y + 6, cw - 22);
    y += 50;
  }

  // footer
  y += 8; hline(ctx, PAD, W - PAD, y, 1, true); y += 16;
  ctx.textAlign = 'center'; ctx.font = '20px Arial';
  ctx.fillText('Furra Franc — Faleminderit!', W / 2, y);
  y += 40;

  // bottom padding (extra whitespace before cut)
  y += 70;
  return { canvas, height: Math.min(y, canvas.height) };
}

function canvasToRaster(canvas: HTMLCanvasElement, height: number): Uint8Array {
  const ctx = canvas.getContext('2d');
  if (!ctx || height <= 0) return cmd(ESC, 0x40);
  const W = canvas.width;
  const widthBytes = Math.ceil(W / 8);
  const img = ctx.getImageData(0, 0, W, height).data;
  const parts: Uint8Array[] = [cmd(ESC, 0x40)];
  const BAND = 128;
  for (let y0 = 0; y0 < height; y0 += BAND) {
    const h = Math.min(BAND, height - y0);
    const data = new Uint8Array(widthBytes * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < W; x++) {
        const i = ((y0 + y) * W + x) * 4;
        const lum = img[i] * 0.299 + img[i + 1] * 0.587 + img[i + 2] * 0.114;
        if (lum < 176) data[y * widthBytes + (x >> 3)] |= 0x80 >> (x & 7);
      }
    }
    parts.push(
      cmd(GS, 0x76, 0x30, 0x00, widthBytes & 0xff, (widthBytes >> 8) & 0xff, h & 0xff, (h >> 8) & 0xff),
      data,
    );
  }
  parts.push(cmd(ESC, 0x64, 0x03), cmd(GS, 0x56, 0x42, 0x00));
  return merge(...parts);
}

export async function printPreventivImageBT(
  delivery: Delivery & { totalPrice?: number },
  priceMap: Record<string, number>,
): Promise<void> {
  const conn = await bleConnect();
  if (!conn) return;
  const { device, writeChar } = conn;
  try {
    const { canvas, height } = renderReceiptCanvas(delivery, priceMap);
    await bleWrite(writeChar, canvasToRaster(canvas, height));
  } catch (e: unknown) {
    alert('Gabim gjate printimit: ' + (e as Error).message);
  } finally {
    device.gatt.disconnect();
  }
}

// ── shared BLE connect / write ─────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function bleConnect(): Promise<{ device: any; writeChar: any } | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bt = (navigator as any).bluetooth;
  if (!bt) { alert('Bluetooth nuk mbeshtehet. Hap me Chrome ne tablet.'); return null; }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let device: any;
  try {
    device = await bt.requestDevice({ acceptAllDevices: true, optionalServices: BLE_SERVICES.map((s) => s.svc) });
  } catch (e: unknown) {
    if ((e as Error)?.name !== 'NotFoundError')
      alert('Zgjidhja e printerit deshtoi: ' + (e as Error).message);
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let server: any;
  try {
    server = await device.gatt.connect();
  } catch (e: unknown) {
    alert('Lidhja GATT deshtoi: ' + (e as Error).message);
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let writeChar: any = null;
  for (const { svc, chr } of BLE_SERVICES) {
    try {
      const service = await server.getPrimaryService(svc);
      writeChar = await service.getCharacteristic(chr);
      break;
    } catch { /* try next */ }
  }

  if (!writeChar) {
    alert('Nuk u gjet sherbimi i printerit. Sigurohu qe OCBP-M88 eshte i ndezur.');
    device.gatt.disconnect();
    return null;
  }

  return { device, writeChar };
}

function buildClientStatement(
  client: Pick<Client, 'id' | 'name' | 'address' | 'phone'>,
  deliveries: Delivery[],
  filterLabel: string,
): Uint8Array {
  const now  = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const sorted = [...deliveries].sort(
    (a, b) => new Date(a.deliveryDate ?? a.createdAt).getTime() - new Date(b.deliveryDate ?? b.createdAt).getTime(),
  );

  const grouped: Record<string, Delivery[]> = {};
  for (const d of sorted) {
    const key = formatDateAL(d.deliveryDate ?? d.createdAt, true);
    (grouped[key] ??= []).push(d);
  }

  let grandTotal = 0;
  const bodyParts: Uint8Array[] = [];
  for (const [dateLabel, items] of Object.entries(grouped)) {
    bodyParts.push(cmd(ESC, 0x45, 0x01), row(dateLabel), cmd(ESC, 0x45, 0x00));
    for (const d of items) {
      const total = d.totalPrice ?? 0;
      grandTotal += total;
      for (const i of d.items) {
        bodyParts.push(row(`  ${i.product.name} x${i.quantity}`));
      }
      bodyParts.push(lr('  Totali:', `${total.toFixed(0)} L`), nl());
    }
    bodyParts.push(sep());
  }

  return merge(
    cmd(ESC, 0x40),
    cmd(ESC, 0x61, 0x01), cmd(GS, 0x21, 0x11), cmd(ESC, 0x45, 0x01),
    row('FURRA FRANC'),
    cmd(GS, 0x21, 0x00), cmd(ESC, 0x45, 0x00),
    row(`Fature - ${safe(filterLabel)}`),
    nl(),
    sep('='),
    cmd(ESC, 0x61, 0x00),
    cmd(ESC, 0x45, 0x01), row(`Klienti: ${client.name}`), cmd(ESC, 0x45, 0x00),
    ...(client.address ? [row(`Adresa:  ${client.address}`)] : []),
    ...(client.phone   ? [row(`Tel:     ${client.phone}`)]   : []),
    row(`Ora: ${time}`),
    sep('='),
    ...bodyParts,
    cmd(ESC, 0x45, 0x01), cmd(GS, 0x21, 0x11),
    lr('TOTAL:', `${grandTotal.toFixed(0)} L`),
    cmd(GS, 0x21, 0x00), cmd(ESC, 0x45, 0x00),
    sep('='),
    cmd(ESC, 0x61, 0x01),
    row('Furra Franc - Faleminderit!'),
    cmd(ESC, 0x64, 0x08),
    cmd(GS, 0x56, 0x42, 0x00),
  );
}

export async function printClientStatementBT(
  client: Pick<Client, 'id' | 'name' | 'address' | 'phone'>,
  deliveries: Delivery[],
  filterLabel: string,
): Promise<void> {
  const conn = await bleConnect();
  if (!conn) return;
  const { device, writeChar } = conn;
  try {
    await bleWrite(writeChar, buildClientStatement(client, deliveries, filterLabel));
  } catch (e: unknown) {
    alert('Gabim gjate printimit: ' + (e as Error).message);
  } finally {
    device.gatt.disconnect();
  }
}

export async function printPreventivBT(
  delivery: Delivery & { totalPrice?: number },
  priceMap: Record<string, number>,
): Promise<void> {
  const conn = await bleConnect();
  if (!conn) return;
  const { device, writeChar } = conn;
  try {
    await bleWrite(writeChar, buildReceipt(delivery, priceMap));
  } catch (e: unknown) {
    alert('Gabim gjate printimit: ' + (e as Error).message);
  } finally {
    device.gatt.disconnect();
  }
}

// ── 80 mm shop receipt (W = 48) ────────────────────────────────────────────
const W80 = 48;

function lr80(left: string, right: string): Uint8Array {
  const l = safe(left).substring(0, W80 - right.length - 1);
  const r = safe(right);
  return enc(l + ' '.repeat(Math.max(1, W80 - l.length - r.length)) + r + '\n');
}

function buildShopReceipt(sale: ShopSale): Uint8Array {
  const date = formatDateAL(sale.saleDate, true);
  const now  = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const shopName = sale.user.client?.name ?? sale.user.name;

  const itemParts: Uint8Array[] = [];
  let total = 0;
  for (const item of sale.items) {
    const lineTotal = item.quantity * Number(item.unitPrice);
    total += lineTotal;
    itemParts.push(
      row(item.shopProduct.name),
      lr80(`  ${item.quantity} x ${Number(item.unitPrice).toFixed(0)} L`, `${lineTotal.toFixed(0)} L`),
    );
  }

  return merge(
    cmd(ESC, 0x40),
    cmd(ESC, 0x61, 0x01), cmd(GS, 0x21, 0x11), cmd(ESC, 0x45, 0x01),
    row('FURRA FRANC'),
    cmd(GS, 0x21, 0x00), cmd(ESC, 0x45, 0x00),
    row(safe(shopName)),
    nl(),
    enc('='.repeat(W80) + '\n'),
    cmd(ESC, 0x61, 0x00),
    lr80(`Data: ${date}`, `Ora: ${time}`),
    enc('-'.repeat(W80) + '\n'),
    lr80('Produkti', 'Total'),
    enc('-'.repeat(W80) + '\n'),
    ...itemParts,
    enc('-'.repeat(W80) + '\n'),
    cmd(ESC, 0x45, 0x01), cmd(GS, 0x21, 0x11),
    lr80('TOTAL:', `${total.toFixed(0)} L`),
    cmd(GS, 0x21, 0x00), cmd(ESC, 0x45, 0x00),
    ...(sale.notes ? [enc('-'.repeat(W80) + '\n'), row(`Note: ${sale.notes}`)] : []),
    enc('='.repeat(W80) + '\n'),
    cmd(ESC, 0x61, 0x01),
    row('Furra Franc - Faleminderit!'),
    cmd(ESC, 0x64, 0x08),
    cmd(GS, 0x56, 0x42, 0x00),
  );
}

export async function printShopReceiptBT(sale: ShopSale): Promise<void> {
  const conn = await bleConnect();
  if (!conn) return;
  const { device, writeChar } = conn;
  try {
    await bleWrite(writeChar, buildShopReceipt(sale));
  } catch (e: unknown) {
    alert('Gabim gjate printimit: ' + (e as Error).message);
  } finally {
    device.gatt.disconnect();
  }
}
