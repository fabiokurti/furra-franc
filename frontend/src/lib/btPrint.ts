import type { Delivery } from '@/types';
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
    const price    = priceMap[item.productId] ?? 0;
    const lineTotal = item.quantity * price;
    calcTotal += lineTotal;
    itemParts.push(
      row(item.product.name),
      lr(`  ${item.quantity} x ${price} L`, `${lineTotal} L`),
    );
  }
  const total = calcTotal > 0 ? calcTotal : (delivery.totalPrice ?? 0);

  return merge(
    cmd(ESC, 0x40),
    cmd(ESC, 0x61, 0x01), cmd(GS, 0x21, 0x11), cmd(ESC, 0x45, 0x01),
    row('FURRA FRANC'),
    cmd(GS, 0x21, 0x00), cmd(ESC, 0x45, 0x00),
    row('Preventiv Dergese'),
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
    cmd(ESC, 0x45, 0x01), cmd(GS, 0x21, 0x11),
    lr('TOTAL:', `${total.toFixed(0)} L`),
    cmd(GS, 0x21, 0x00), cmd(ESC, 0x45, 0x00),
    ...(delivery.notes ? [sep(), row(`Note: ${delivery.notes}`)] : []),
    sep('='),
    cmd(ESC, 0x61, 0x01),
    row('Furra Franc - Faleminderit!'),
    nl(), nl(), nl(),
    cmd(GS, 0x56, 0x42, 0x00),
  );
}

export async function printPreventivBT(
  delivery: Delivery & { totalPrice?: number },
  priceMap: Record<string, number>,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bt = (navigator as any).bluetooth;
  if (!bt) { alert('Bluetooth nuk mbeshtehet. Hap me Chrome ne tablet.'); return; }

  const data = buildReceipt(delivery, priceMap);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let device: any;
  try {
    device = await bt.requestDevice({
      acceptAllDevices: true,
      optionalServices: BLE_SERVICES.map((s) => s.svc),
    });
  } catch (e: unknown) {
    if ((e as Error)?.name !== 'NotFoundError')
      alert('Zgjidhja e printerit deshtoi: ' + (e as Error).message);
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let server: any;
  try {
    server = await device.gatt.connect();
  } catch (e: unknown) {
    alert('Lidhja GATT deshtoi: ' + (e as Error).message);
    return;
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
    return;
  }

  try {
    await bleWrite(writeChar, data);
  } catch (e: unknown) {
    alert('Gabim gjate printimit: ' + (e as Error).message);
  } finally {
    device.gatt.disconnect();
  }
}
