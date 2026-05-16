import { formatDateAL } from './date';
import type { Delivery } from '@/types';

export function printPreventiv(
  delivery: Delivery & { totalPrice?: number },
  priceMap: Record<string, number>,
) {
  const date = formatDateAL(delivery.deliveryDate, true);
  const now  = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  let calcTotal = 0;
  const itemsRows = delivery.items.map((item) => {
    const price     = priceMap[item.productId] ?? 0;
    const lineTotal = item.quantity * price;
    calcTotal += lineTotal;
    return `
      <tr>
        <td>${item.product.name}</td>
        <td style="text-align:center">${item.quantity}</td>
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
