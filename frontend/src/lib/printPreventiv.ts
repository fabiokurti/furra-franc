import { formatDateAL } from './date';
import type { Client, Delivery, ShopSale } from '@/types';

// Group digits with a thin space: 1050 -> "1 050"
function money(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' L';
}

/**
 * Styled preventiv for browser/USB printing (80mm or 88mm thermal paper).
 * Renders the invoice-card design: dark bar, header + paid pill, meta grid,
 * items table with a dedicated "Kthyer" (returned) column, and net total.
 */
export function printPreventivWide(
  delivery: Delivery & { totalPrice?: number },
  priceMap: Record<string, number>,
  widthMm: 80 | 88 = 80,
) {
  const date = formatDateAL(delivery.deliveryDate, true);
  const now  = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const paid = delivery.isPaid;

  let calcTotal = 0;
  const rows = delivery.items.map((item) => {
    const price        = priceMap[item.productId] ?? 0;
    const returnedQty  = item.returnedQuantity ?? 0;
    const effectiveQty = item.quantity - returnedQty;
    const lineTotal    = effectiveQty * price;
    calcTotal += lineTotal;
    const retCell = returnedQty > 0
      ? `<span class="ret-badge">${returnedQty}</span>`
      : `<span class="ret-none">&mdash;</span>`;
    return `<tr>
      <td class="name">${item.product.name}</td>
      <td class="center">${item.quantity}</td>
      <td class="center">${retCell}</td>
      <td class="num">${money(price)}</td>
      <td class="num">${money(lineTotal)}</td>
    </tr>`;
  }).join('');

  const total = calcTotal > 0 ? calcTotal : (delivery.totalPrice ?? 0);

  const html = `<!DOCTYPE html>
<html lang="sq">
<head>
  <meta charset="UTF-8">
  <title>Preventiv - ${delivery.client.name}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    @page{size:${widthMm}mm auto;margin:0}
    html,body{background:#fff;width:${widthMm}mm}
    body{font-family:ui-sans-serif,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:#000;font-size:9px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .invoice{width:100%}
    .invoice-bar{height:4px;background:#000}
    .invoice-body{padding:8px 5px 6px}
    .invoice-head{display:flex;justify-content:space-between;align-items:flex-start;gap:6px;padding-bottom:8px;border-bottom:1px solid #999}
    .brand{font-size:14px;font-weight:800;letter-spacing:.01em}
    .brand-sub{margin-top:1px;font-size:6.5px;letter-spacing:.1em;text-transform:uppercase;color:#333;font-weight:700}
    .pill{font-size:7px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;border:1px solid #000;border-radius:999px;padding:2px 6px;white-space:nowrap}
    .pill.paid{background:#000;color:#fff}
    .meta{display:grid;grid-template-columns:1fr 1fr;gap:6px 8px;padding:8px 0;border-bottom:1px solid #999}
    .meta .label{font-size:6.5px;letter-spacing:.06em;text-transform:uppercase;color:#444;font-weight:700;margin-bottom:1px}
    .meta .value{font-size:10px;font-weight:700;overflow-wrap:break-word}
    table{width:100%;border-collapse:collapse;margin-top:8px;table-layout:fixed}
    thead th{text-align:left;font-size:6.5px;letter-spacing:.03em;text-transform:uppercase;color:#333;font-weight:700;padding:0 2px 4px;border-bottom:1.5px solid #000}
    thead th.num,tbody td.num,tfoot td.num{text-align:right}
    thead th.center,tbody td.center{text-align:center}
    th.c-name{width:auto}th.c-qty,th.c-ret{width:9%}th.c-price,th.c-total{width:22%}
    tbody td{padding:5px 2px;font-size:9.5px;border-bottom:1px solid #ddd;font-variant-numeric:tabular-nums;vertical-align:top;word-break:break-word}
    tbody td.num{white-space:nowrap}
    tbody td.name{font-weight:700}
    .ret-badge{display:inline-block;min-width:13px;font-size:8.5px;font-weight:700;border:1px solid #000;border-radius:4px;padding:0 4px;font-variant-numeric:tabular-nums}
    .ret-none{color:#999}
    tfoot td{padding:7px 2px 2px;font-variant-numeric:tabular-nums}
    tfoot .total-label{font-size:9px;font-weight:700;border-top:1.5px solid #000;padding-top:7px}
    tfoot .total-value{font-size:13px;font-weight:800;border-top:1.5px solid #000;padding-top:6px;text-align:right;white-space:nowrap}
    .note{margin-top:8px;padding:5px 7px;border-left:2px solid #000;font-size:8.5px;color:#222;font-style:italic}
    .foot{text-align:center;padding:9px 5px 6px;font-size:8.5px;color:#555;border-top:1px dashed #999;margin-top:8px}
  </style>
</head>
<body>
  <div class="invoice">
    <div class="invoice-bar"></div>
    <div class="invoice-body">
      <div class="invoice-head">
        <div>
          <div class="brand">Furra Franc</div>
          <div class="brand-sub">Preventiv d&euml;rgese</div>
        </div>
        <div class="pill ${paid ? 'paid' : ''}">${paid ? 'Paguar' : 'Pa paguar'}</div>
      </div>

      <div class="meta">
        <div><div class="label">Data</div><div class="value">${date}</div></div>
        <div><div class="label">Ora</div><div class="value">${time}</div></div>
        <div><div class="label">Klienti</div><div class="value">${delivery.client.name}</div></div>
        <div><div class="label">Shp&euml;rnd&euml;r&euml;si</div><div class="value">${delivery.createdBy.name}</div></div>
      </div>

      <table>
        <thead>
          <tr>
            <th class="c-name">Produkti</th>
            <th class="center c-qty">Sasia</th>
            <th class="center c-ret">Kthyer</th>
            <th class="num c-price">&Ccedil;mimi</th>
            <th class="num c-total">Totali</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td class="total-label" colspan="4">Totali (pas kthimeve)</td>
            <td class="total-value">${money(total)}</td>
          </tr>
        </tfoot>
      </table>

      ${delivery.notes ? `<div class="note">Sh&euml;nim: ${delivery.notes}</div>` : ''}
    </div>
    <div class="foot">Furra Franc &mdash; Faleminderit!</div>
  </div>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=420,height=700,toolbar=0,scrollbars=0,status=0');
  if (!win) { alert('Lejo dritaret pop-up per te printuar preventiven.'); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 400);
}

export function printPreventiv(
  delivery: Delivery & { totalPrice?: number },
  priceMap: Record<string, number>,
) {
  const date = formatDateAL(delivery.deliveryDate, true);
  const now  = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  let calcTotal = 0;
  const itemsRows = delivery.items.map((item) => {
    const price       = priceMap[item.productId] ?? 0;
    const returnedQty  = item.returnedQuantity ?? 0;
    const effectiveQty = item.quantity - returnedQty;
    const lineTotal    = effectiveQty * price;
    calcTotal += lineTotal;
    return `
      <tr>
        <td>${item.product.name}</td>
        <td style="text-align:center">${item.quantity}${returnedQty > 0 ? `<br><span style="font-size:8pt">(K: ${returnedQty})</span>` : ''}</td>
        <td style="text-align:right">${price} L</td>
        <td style="text-align:right;font-weight:bold">${lineTotal} L</td>
      </tr>`;
  }).join('');

  const total = calcTotal > 0 ? calcTotal : (delivery.totalPrice ?? 0);

  const html = `<!DOCTYPE html>
<html lang="sq">
<head>
  <meta charset="UTF-8">
  <title>Preventiv - ${delivery.client.name}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Courier New',Courier,monospace;font-size:11pt;color:#000;padding:10mm 12mm}
    .c{text-align:center}
    .b{font-weight:bold}
    .lg{font-size:16pt}
    .sm{font-size:9pt}
    .sep{border-top:1px dashed #000;margin:6px 0}
    .sep2{border-top:2px solid #000;margin:6px 0}
    table{width:100%;border-collapse:collapse;margin-top:4px}
    th{text-align:left;border-bottom:2px solid #000;padding:3px 4px;font-size:10pt}
    th:not(:first-child){text-align:right}
    th:nth-child(2){text-align:center}
    td{padding:3px 4px;border-bottom:1px dashed #eee;vertical-align:top}
    .total-row td{border-top:2px solid #000;border-bottom:none;padding-top:6px;font-weight:bold;font-size:13pt}
    @page{margin:8mm}
    @media print{body{padding:0}}
  </style>
</head>
<body>
  <div class="c b lg">FURRA FRANC</div>
  <div class="c sm">Preventiv Dergese</div>
  <div class="sep2"></div>

  <div><span class="b">Data:</span> ${date} &nbsp; <span class="b">Ora:</span> ${time}</div>
  <div class="sep"></div>
  <div><span class="b">Klienti:</span> ${delivery.client.name}</div>
  ${delivery.client.address ? `<div class="sm">Adresa: ${delivery.client.address}</div>` : ''}
  ${delivery.client.phone   ? `<div class="sm">Tel: ${delivery.client.phone}</div>`       : ''}
  <div><span class="b">Shperndaresi:</span> ${delivery.createdBy.name}</div>
  <div class="sep"></div>

  <table>
    <thead>
      <tr>
        <th>Produkti</th>
        <th style="text-align:center">Sasia</th>
        <th style="text-align:right">&#215; Cmimi</th>
        <th style="text-align:right">= Totali</th>
      </tr>
    </thead>
    <tbody>${itemsRows}</tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="3">TOTAL</td>
        <td style="text-align:right">${total.toFixed(0)} L</td>
      </tr>
    </tfoot>
  </table>

  ${delivery.notes ? `<div class="sep"></div><div class="sm">&#128221; ${delivery.notes}</div>` : ''}
  <div class="sep2"></div>
  <div class="c sm">Furra Franc &mdash; Faleminderit!</div>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=600,height=700,toolbar=0,scrollbars=0,status=0');
  if (!win) { alert('Lejo dritaret pop-up per te printuar preventiven.'); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 400);
}

export function printClientStatement(
  client: Pick<Client, 'id' | 'name' | 'address' | 'phone'>,
  deliveries: Delivery[],
  filterLabel: string,
) {
  const now  = new Date();
  const date = formatDateAL(now, true);
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
  let rows = '';
  for (const [dateLabel, items] of Object.entries(grouped)) {
    rows += `<tr class="date-row"><td colspan="2">${dateLabel}</td></tr>`;
    for (const d of items) {
      const total = d.totalPrice ?? 0;
      grandTotal += total;
      const itemsList = d.items.map((i) => `${i.product.name} &#215;${i.quantity}`).join(', ');
      rows += `<tr><td>${itemsList}</td><td style="text-align:right;font-weight:bold;white-space:nowrap">${total.toFixed(0)} L</td></tr>`;
    }
  }

  const html = `<!DOCTYPE html>
<html lang="sq">
<head>
  <meta charset="UTF-8">
  <title>Fature - ${client.name}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Courier New',Courier,monospace;font-size:11pt;color:#000;padding:10mm 12mm}
    .c{text-align:center}
    .b{font-weight:bold}
    .lg{font-size:16pt}
    .sm{font-size:9pt}
    .sep{border-top:1px dashed #000;margin:6px 0}
    .sep2{border-top:2px solid #000;margin:6px 0}
    table{width:100%;border-collapse:collapse;margin-top:4px}
    th{text-align:left;border-bottom:2px solid #000;padding:3px 4px;font-size:10pt}
    th:last-child{text-align:right}
    td{padding:3px 4px;border-bottom:1px dashed #eee;vertical-align:top}
    .date-row td{background:#f0f0f0;font-weight:bold;padding:5px 4px;border-bottom:none;font-size:10pt;border-top:1px solid #ccc}
    .total-row td{border-top:2px solid #000;border-bottom:none;padding-top:6px;font-weight:bold;font-size:13pt}
    @page{margin:8mm}
    @media print{body{padding:0}}
  </style>
</head>
<body>
  <div class="c b lg">FURRA FRANC</div>
  <div class="c sm">Fature — ${filterLabel}</div>
  <div class="sep2"></div>
  <div><span class="b">Klienti:</span> ${client.name}</div>
  ${client.address ? `<div class="sm">Adresa: ${client.address}</div>` : ''}
  ${client.phone   ? `<div class="sm">Tel: ${client.phone}</div>` : ''}
  <div class="sm" style="margin-top:4px">Printuar: ${date} &mdash; ${time}</div>
  <div class="sep"></div>
  <table>
    <thead>
      <tr><th>Data / Produktet</th><th style="text-align:right">Totali</th></tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr class="total-row">
        <td>TOTAL</td>
        <td style="text-align:right">${grandTotal.toFixed(0)} L</td>
      </tr>
    </tfoot>
  </table>
  <div class="sep2"></div>
  <div class="c sm">Furra Franc &mdash; Faleminderit!</div>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=640,height=750,toolbar=0,scrollbars=0,status=0');
  if (!win) { alert('Lejo dritaret pop-up per te printuar.'); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 400);
}

export function printShopReceiptUSB(sale: ShopSale) {
  const date     = formatDateAL(sale.saleDate, true);
  const now      = new Date();
  const time     = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const shopName = sale.user.client?.name ?? sale.user.name;

  let total = 0;
  const itemRows = sale.items.map((item) => {
    const lineTotal = item.quantity * Number(item.unitPrice);
    total += lineTotal;
    return `<tr>
      <td>${item.shopProduct.name}</td>
      <td class="c">${item.quantity}</td>
      <td class="r">${Number(item.unitPrice).toFixed(0)} L</td>
      <td class="r b">${lineTotal.toFixed(0)} L</td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="sq">
<head>
  <meta charset="UTF-8">
  <title>Fature - ${shopName}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    @page{size:80mm auto;margin:3mm 2mm}
    body{font-family:'Courier New',Courier,monospace;font-size:8.5pt;color:#000;width:76mm}
    .c{text-align:center} .r{text-align:right} .b{font-weight:bold}
    .lg{font-size:13pt} .sm{font-size:7.5pt}
    .sep{border-top:1px dashed #000;margin:4px 0}
    .sep2{border-top:2px solid #000;margin:5px 0}
    table{width:100%;border-collapse:collapse;margin-top:3px}
    th{text-align:left;border-bottom:1px solid #000;padding:2px;font-size:8pt}
    td{padding:2px;border-bottom:1px dashed #ccc}
    .total-row td{border-top:2px solid #000;border-bottom:none;padding-top:5px;font-weight:bold;font-size:10pt}
    @media print{body{padding:0}}
  </style>
</head>
<body>
  <div class="c b lg">FURRA FRANC</div>
  <div class="c sm">${shopName}</div>
  <div class="sep2"></div>
  <div class="sm">${date} &nbsp;&nbsp; Ora: ${time}</div>
  <div class="sep"></div>
  <table>
    <thead>
      <tr>
        <th>Produkti</th>
        <th class="c">Sas.</th>
        <th class="r">Cmimi</th>
        <th class="r">Total</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="3">TOTAL</td>
        <td class="r">${total.toFixed(0)} L</td>
      </tr>
    </tfoot>
  </table>
  ${sale.notes ? `<div class="sep"></div><div class="sm">${sale.notes}</div>` : ''}
  <div class="sep2"></div>
  <div class="c sm">Furra Franc - Faleminderit!</div>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=320,height=600,toolbar=0,scrollbars=0,status=0');
  if (!win) { alert('Lejo dritaret pop-up per te printuar.'); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 400);
}
