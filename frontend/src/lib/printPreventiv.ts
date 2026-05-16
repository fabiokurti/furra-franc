import { formatDateAL } from './date';
import type { Delivery } from '@/types';

export function printPreventiv(delivery: Delivery & { totalPrice?: number }) {
  const date = formatDateAL(delivery.deliveryDate, true);
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const itemsRows = delivery.items
    .map(
      (item) =>
        `<tr><td>${item.product.name}</td><td style="text-align:right;white-space:nowrap">&#215;${item.quantity}</td></tr>`
    )
    .join('');

  const totalRow =
    delivery.totalPrice !== undefined
      ? `<tr style="border-top:1px solid #000">
           <td style="font-weight:bold;padding-top:5px;font-size:13pt">TOTAL</td>
           <td style="font-weight:bold;padding-top:5px;font-size:13pt;text-align:right;white-space:nowrap">${delivery.totalPrice.toFixed(0)} L</td>
         </tr>`
      : '';

  const html = `<!DOCTYPE html>
<html lang="sq">
<head>
  <meta charset="UTF-8">
  <title>Preventiv - ${delivery.client.name}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{
      font-family:'Courier New',Courier,monospace;
      font-size:11pt;
      color:#000;
      width:72mm;
      padding:4mm 3mm 8mm;
    }
    .c{text-align:center}
    .b{font-weight:bold}
    .sm{font-size:9pt}
    .lg{font-size:15pt}
    .sep{border-top:1px dashed #000;margin:5px 0}
    .sep2{border-top:2px solid #000;margin:5px 0}
    table{width:100%;border-collapse:collapse}
    td{padding:2px 0;vertical-align:top}
    th{text-align:left;border-bottom:1px dashed #000;padding-bottom:3px;font-size:10pt}
    th:last-child{text-align:right}
    @page{size:80mm auto;margin:0}
    @media print{body{width:72mm}}
  </style>
</head>
<body>
  <div class="c b lg">FURRA FRANC</div>
  <div class="c sm">Preventiv Dërgese</div>
  <div class="sep2"></div>

  <div><span class="b">Data:</span> ${date}</div>
  <div><span class="b">Ora:</span>  ${time}</div>
  <div class="sep"></div>

  <div><span class="b">Klienti:</span> ${delivery.client.name}</div>
  ${delivery.client.address ? `<div class="sm">Adresa: ${delivery.client.address}</div>` : ''}
  ${delivery.client.phone ? `<div class="sm">Tel: ${delivery.client.phone}</div>` : ''}
  <div><span class="b">Shpërndarësi:</span> ${delivery.createdBy.name}</div>
  <div class="sep"></div>

  <table>
    <thead>
      <tr>
        <th>Produkti</th>
        <th style="text-align:right">Sasia</th>
      </tr>
    </thead>
    <tbody>
      ${itemsRows}
    </tbody>
    <tfoot>
      ${totalRow}
    </tfoot>
  </table>

  ${delivery.notes ? `<div class="sep"></div><div class="sm">&#128221; ${delivery.notes}</div>` : ''}

  <div class="sep2"></div>
  <div class="c sm">Furra Franc &mdash; Faleminderit!</div>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=420,height=650,toolbar=0,scrollbars=0,status=0');
  if (!win) {
    alert('Lejo dritaret pop-up për të printuar preventivën.');
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
    win.close();
  }, 400);
}
