import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// How far back we pull data to keep the context bounded.
const LOOKBACK_DAYS = 180;

type ChatMessage = { role: 'user' | 'assistant'; content: string };

const WEEKDAYS_SQ = ['E diel', 'E hënë', 'E martë', 'E mërkurë', 'E enjte', 'E premte', 'E shtunë'];

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function weekday(d: Date): string {
  return WEEKDAYS_SQ[d.getUTCDay()];
}

/** Monday (UTC) of the week that `dateStr` (YYYY-MM-DD) falls in. */
function mondayOf(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? 6 : day - 1; // days since Monday
  d.setUTCDate(d.getUTCDate() - diff);
  return ymd(d);
}

function ddmm(dateStr: string): string {
  const [, m, day] = dateStr.split('-');
  return `${day}/${m}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Builds a comprehensive, structured snapshot of the bakery's data so the model
 * can act as a finance analyst: production, deliveries (with client + distributor
 * + revenue), returns, shop sales, and precomputed aggregate summaries.
 *
 * `message` is the user's question — if it mentions one or more known client
 * names, a detailed per-client breakdown is injected so the model can answer
 * client-specific comparisons without bloating the prompt for everyone.
 */
async function buildDataContext(message = '') {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - LOOKBACK_DAYS);
  since.setUTCHours(0, 0, 0, 0);

  const [products, dailyStocks, deliveries, returns, shopSales, clientPrices] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, name: true, category: true, price: true },
    }),
    prisma.dailyStock.findMany({
      where: { date: { gte: since } },
      orderBy: { date: 'asc' },
      include: {
        items: { include: { product: { select: { name: true } } } },
      },
    }),
    prisma.delivery.findMany({
      where: { deliveryDate: { gte: since }, status: 'COMPLETED' },
      orderBy: { deliveryDate: 'asc' },
      include: {
        client: { select: { name: true } },
        createdBy: { select: { name: true } },
        items: { include: { product: { select: { id: true, name: true, price: true } } } },
      },
    }),
    prisma.return.findMany({
      where: { returnDate: { gte: since } },
      orderBy: { returnDate: 'asc' },
      include: {
        client: { select: { name: true } },
        items: { include: { product: { select: { name: true } } } },
      },
    }),
    prisma.shopSale.findMany({
      where: { saleDate: { gte: since } },
      orderBy: { saleDate: 'asc' },
      include: {
        user: { select: { name: true } },
        items: { include: { shopProduct: { select: { name: true } } } },
      },
    }),
    prisma.clientProductPrice.findMany(),
  ]);

  // Client-specific price lookup: `${clientId}:${productId}` -> price.
  const priceMap = new Map<string, number>();
  for (const cp of clientPrices) priceMap.set(`${cp.clientId}:${cp.productId}`, Number(cp.price));

  // ── Production per day (from daily stock entries) ──
  const production = dailyStocks.map((ds) => {
    const d = new Date(ds.date);
    return {
      date: ymd(d),
      weekday: weekday(d),
      status: ds.status,
      items: ds.items.map((it) => ({ product: it.product.name, quantity: it.quantity })),
      total: ds.items.reduce((s, it) => s + it.quantity, 0),
    };
  });

  // ── Deliveries (= sales to clients), detailed with revenue ──
  const salesByProduct: Record<string, { quantity: number; revenue: number }> = {};
  const salesByDistributor: Record<string, { deliveries: number; quantity: number; revenue: number }> = {};
  const salesByClient: Record<string, { revenue: number; paid: number; unpaid: number }> = {};
  let deliveryRevenue = 0;
  let deliveryPaid = 0;
  let deliveryUnpaid = 0;

  const deliveriesDetailed = deliveries.map((d) => {
    const distributor = d.createdBy?.name ?? 'I panjohur';
    const clientName = d.client?.name ?? 'I panjohur';
    let revenue = 0;
    let quantity = 0;
    const items = d.items.map((it) => {
      const netQty = it.quantity - it.returnedQuantity;
      const unit = priceMap.get(`${d.clientId}:${it.productId}`) ?? Number(it.product.price);
      const lineRevenue = unit * netQty;
      revenue += lineRevenue;
      quantity += netQty;

      const sp = (salesByProduct[it.product.name] ??= { quantity: 0, revenue: 0 });
      sp.quantity += netQty;
      sp.revenue += lineRevenue;

      return { product: it.product.name, quantity: netQty, revenue: round2(lineRevenue) };
    });

    deliveryRevenue += revenue;
    if (d.isPaid) deliveryPaid += revenue;
    else deliveryUnpaid += revenue;

    const sd = (salesByDistributor[distributor] ??= { deliveries: 0, quantity: 0, revenue: 0 });
    sd.deliveries += 1;
    sd.quantity += quantity;
    sd.revenue += revenue;

    const sc = (salesByClient[clientName] ??= { revenue: 0, paid: 0, unpaid: 0 });
    sc.revenue += revenue;
    if (d.isPaid) sc.paid += revenue;
    else sc.unpaid += revenue;

    const dt = new Date(d.deliveryDate);
    return {
      date: ymd(dt),
      weekday: weekday(dt),
      client: clientName,
      distributor,
      isPaid: d.isPaid,
      revenue: round2(revenue),
      items,
    };
  });

  // ── Returns per day per product ──
  const returnByDay: Record<string, Record<string, number>> = {};
  for (const r of returns) {
    const key = ymd(new Date(r.returnDate));
    returnByDay[key] ??= {};
    for (const it of r.items) {
      returnByDay[key][it.product.name] = (returnByDay[key][it.product.name] ?? 0) + it.quantity;
    }
  }
  const returnsSummary = Object.entries(returnByDay).map(([date, items]) => ({
    date,
    weekday: weekday(new Date(date)),
    items: Object.entries(items).map(([product, quantity]) => ({ product, quantity })),
  }));

  // ── Shop sales (direct counter sales) ──
  const shopByProduct: Record<string, { quantity: number; revenue: number }> = {};
  const shopBySeller: Record<string, { revenue: number }> = {};
  let shopRevenue = 0;
  const shopSalesDetailed = shopSales.map((s) => {
    const seller = s.user?.name ?? 'I panjohur';
    let revenue = 0;
    const items = s.items.map((it) => {
      const lineRevenue = Number(it.unitPrice) * it.quantity;
      revenue += lineRevenue;
      const sp = (shopByProduct[it.shopProduct.name] ??= { quantity: 0, revenue: 0 });
      sp.quantity += it.quantity;
      sp.revenue += lineRevenue;
      return { product: it.shopProduct.name, quantity: it.quantity, revenue: round2(lineRevenue) };
    });
    shopRevenue += revenue;
    (shopBySeller[seller] ??= { revenue: 0 }).revenue += revenue;
    const dt = new Date(s.saleDate);
    return { date: ymd(dt), weekday: weekday(dt), seller, revenue: round2(revenue), items };
  });

  // ── Daily aggregates: production vs sales side by side ──
  type DayAgg = {
    date: string;
    weekday: string;
    productionQty: number;
    salesQty: number;
    salesRevenue: number;
    returnsQty: number;
    shopRevenue: number;
  };
  const dayMap: Record<string, DayAgg> = {};
  const ensureDay = (date: string): DayAgg =>
    (dayMap[date] ??= {
      date,
      weekday: weekday(new Date(date + 'T00:00:00Z')),
      productionQty: 0,
      salesQty: 0,
      salesRevenue: 0,
      returnsQty: 0,
      shopRevenue: 0,
    });

  for (const p of production) ensureDay(p.date).productionQty += p.total;
  for (const d of deliveriesDetailed) {
    const day = ensureDay(d.date);
    day.salesRevenue += d.revenue;
    day.salesQty += d.items.reduce((s, it) => s + it.quantity, 0);
  }
  for (const r of returnsSummary) {
    ensureDay(r.date).returnsQty += r.items.reduce((s, it) => s + it.quantity, 0);
  }
  for (const s of shopSalesDetailed) ensureDay(s.date).shopRevenue += s.revenue;

  const daily = Object.values(dayMap)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({
      ...d,
      salesRevenue: round2(d.salesRevenue),
      shopRevenue: round2(d.shopRevenue),
    }));

  // ── Weekly aggregates (weeks start Monday) ──
  type WeekAgg = {
    weekStart: string;
    weekLabel: string;
    productionQty: number;
    salesQty: number;
    salesRevenue: number;
    returnsQty: number;
    shopRevenue: number;
  };
  const weekMap: Record<string, WeekAgg> = {};
  for (const d of daily) {
    const wk = mondayOf(d.date);
    const w = (weekMap[wk] ??= {
      weekStart: wk,
      weekLabel: '',
      productionQty: 0,
      salesQty: 0,
      salesRevenue: 0,
      returnsQty: 0,
      shopRevenue: 0,
    });
    w.productionQty += d.productionQty;
    w.salesQty += d.salesQty;
    w.salesRevenue += d.salesRevenue;
    w.returnsQty += d.returnsQty;
    w.shopRevenue += d.shopRevenue;
  }
  const weekly = Object.values(weekMap)
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
    .map((w) => {
      const end = new Date(w.weekStart + 'T00:00:00Z');
      end.setUTCDate(end.getUTCDate() + 6);
      return {
        ...w,
        weekLabel: `${ddmm(w.weekStart)} - ${ddmm(ymd(end))}`,
        salesRevenue: round2(w.salesRevenue),
        shopRevenue: round2(w.shopRevenue),
      };
    });

  // ── Precomputed summaries (sorted, ready for "top X" questions) ──
  // Cap each list so the prompt stays well within the model's token limit.
  const TOP_N = 50;
  const toSortedArray = <T extends Record<string, number>>(
    obj: Record<string, T>,
    key: string,
    sortField: keyof T,
  ) =>
    Object.entries(obj)
      .map(([name, v]) => ({ [key]: name, ...v }))
      .sort((a, b) => Number(b[sortField]) - Number(a[sortField]))
      .slice(0, TOP_N)
      .map((row) => {
        const out: Record<string, unknown> = {};
        for (const [k, val] of Object.entries(row)) out[k] = typeof val === 'number' ? round2(val) : val;
        return out;
      });

  // Only recent detail is emitted for the day-level arrays; the aggregates
  // (weekly/summaries) still cover the full lookback window.
  const DETAIL_DAYS = 90;
  const detailCutoff = new Date();
  detailCutoff.setUTCDate(detailCutoff.getUTCDate() - DETAIL_DAYS);
  const cutoffStr = ymd(detailCutoff);
  const recent = <T extends { date: string }>(arr: T[]) => arr.filter((r) => r.date >= cutoffStr);

  // ── Per-client detail (only for clients named in the question) ──
  // Keeps the prompt small: full detail is injected only for the asked client(s).
  const clientNames = [...new Set(deliveriesDetailed.map((d) => d.client))];
  const msgLower = message.toLowerCase();
  const focusClients = clientNames
    .filter((name) => name && name !== 'I panjohur' && msgLower.includes(name.toLowerCase()))
    .slice(0, 3);

  const clientDetails = focusClients.map((name) => {
    const rows = deliveriesDetailed.filter((d) => d.client === name);
    const byProduct: Record<string, { quantity: number; revenue: number }> = {};
    const byWeek: Record<string, { qty: number; revenue: number }> = {};
    let revenue = 0;
    let paid = 0;
    let unpaid = 0;
    let qty = 0;
    for (const d of rows) {
      revenue += d.revenue;
      if (d.isPaid) paid += d.revenue;
      else unpaid += d.revenue;
      const wk = mondayOf(d.date);
      const w = (byWeek[wk] ??= { qty: 0, revenue: 0 });
      w.revenue += d.revenue;
      for (const it of d.items) {
        qty += it.quantity;
        w.qty += it.quantity;
        const bp = (byProduct[it.product] ??= { quantity: 0, revenue: 0 });
        bp.quantity += it.quantity;
        bp.revenue += it.revenue;
      }
    }
    const weekly = Object.entries(byWeek)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([wk, v]) => {
        const end = new Date(wk + 'T00:00:00Z');
        end.setUTCDate(end.getUTCDate() + 6);
        return { weekStart: wk, weekLabel: `${ddmm(wk)} - ${ddmm(ymd(end))}`, qty: v.qty, revenue: round2(v.revenue) };
      });
    const productBreakdown = Object.entries(byProduct)
      .map(([product, v]) => ({ product, quantity: v.quantity, revenue: round2(v.revenue) }))
      .sort((a, b) => b.revenue - a.revenue);
    return {
      client: name,
      totals: {
        revenue: round2(revenue),
        paid: round2(paid),
        unpaid: round2(unpaid),
        quantity: qty,
        deliveries: rows.length,
      },
      weekly,
      byProduct: productBreakdown,
      recentDeliveries: recent(rows),
    };
  });

  return {
    currency: 'LEK',
    note: `Të dhënat e detajuara ditore mbulojnë ${DETAIL_DAYS} ditët e fundit; "weekly" dhe "summaries" mbulojnë deri në ${LOOKBACK_DAYS} ditë. Listat te "summaries" janë të kufizuara te ${TOP_N} të parat.`,
    products: products.map((p) => ({ name: p.name, category: p.category, price: Number(p.price) })),
    production: recent(production),
    returns: recent(returnsSummary),
    daily: recent(daily),
    weekly,
    ...(clientDetails.length ? { clientDetails } : {}),
    summaries: {
      salesByProduct: toSortedArray(salesByProduct, 'product', 'revenue'),
      salesByDistributor: toSortedArray(salesByDistributor, 'distributor', 'revenue'),
      salesByClient: toSortedArray(salesByClient, 'client', 'revenue'),
      shopSalesByProduct: toSortedArray(shopByProduct, 'product', 'revenue'),
      shopSalesBySeller: toSortedArray(shopBySeller, 'seller', 'revenue'),
      totals: {
        deliveryRevenue: round2(deliveryRevenue),
        deliveryPaid: round2(deliveryPaid),
        deliveryUnpaid: round2(deliveryUnpaid),
        shopRevenue: round2(shopRevenue),
        grandTotalRevenue: round2(deliveryRevenue + shopRevenue),
      },
    },
  };
}

export async function chat(req: Request, res: Response): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ message: 'OPENAI_API_KEY nuk është konfiguruar në server.' });
    return;
  }

  const { message, history } = req.body as { message?: string; history?: ChatMessage[] };
  if (!message || typeof message !== 'string' || !message.trim()) {
    res.status(400).json({ message: 'Mesazhi kërkohet.' });
    return;
  }

  let data;
  try {
    data = await buildDataContext(message);
  } catch (err) {
    console.error('AI data context error:', err);
    res.status(500).json({ message: 'Gabim gjatë leximit të të dhënave.' });
    return;
  }

  const today = new Date();

  const systemPrompt = `Ti je "financieri" i furrës së bukës "Furra Franc" — një analist financiar dhe i shitjeve.
Ke akses te të gjitha të dhënat e biznesit: prodhimi, shitjet/dërgesat, kthimet, shitjet në dyqan, të ardhurat, klientët dhe shpërndarësit.
Përgjigju GJITHMONË në shqip, qartë dhe konkret, si një financier që i jep pronarit shifra të sakta.
Të gjitha shumat monetare janë në LEK.
Data e sotme është ${ymd(today)}, dita e sotme është "${weekday(today)}".

RREGULLA PËR DATAT (shumë e rëndësishme):
- Çdo hyrje në të dhëna ka fushën "weekday" me emrin e ditës në shqip. MOS i llogarit vetë ditët e javës — përdor fushën "weekday".
- "e diela e kaluar" / "e diela e fundit" = hyrja me weekday="E diel" me datën më të fundit (më e madhja) që NUK është më e vonë se sot.
- "kjo e diel" = e diela më e afërt. Nëse sot është pas së dielës, është e diela e kaluar; nëse ende s'ka ardhur, s'ka të dhëna.
- Kur krahason dy të diela, merr dy hyrjet me weekday="E diel" me datat më të fundit dhe krahaso totalet e tyre.
- Nëse për një datë nuk ka hyrje, thuaj qartë që s'ka të dhëna për atë ditë. Mos shpik shifra.

KUPTIMI I FJALËVE:
- Fjala "bukë"/"buka"/"bukët" në pyetjet e përdoruesit zakonisht i referohet TË GJITHA produkteve të prodhuara (prodhimi total), jo vetëm produkteve me kategori "Bukë". Prandaj për "bukët e prodhuara" përdor fushën "total" të prodhimit, përveç kur përmendet qartë një kategori ose produkt specifik (p.sh. "torta", "byrek", ose një emër produkti).
- Nëse përdoruesi përmend një produkt ose kategori specifike, filtro vetëm atë.

Kur jep numra, jepi të saktë; kur ka kuptim, jep edhe totalin dhe ndarjen. Për diferencat, jep numrin dhe kahun (më shumë/më pak).
Kur pyetesh "kush/cili është më i miri/më shumë" (produkt, shpërndarës, klient), përdor tabelat te "summaries" që janë tashmë të renditura nga më i madhi te më i vogli — merr elementin e parë.
Mos shpik shifra; nëse diçka s'është në të dhëna, thuaje.

RAPORTE DHE KRAHASIME:
- Për raporte javore ose krahasime "javë pas jave", përdor tabelën "weekly". Për "ditë pas dite", përdor "daily". MOS i grupo vetë ditët në javë — janë llogaritur tashmë.
- Kur bën një raport, paraqite si tabelë të pastër (p.sh. javë | prodhim | shitje (sasi) | të ardhura | kthime) dhe shto një përmbledhje të shkurtër me trendin (rritje/rënie) dhe diferencat në përqindje kur ka kuptim.
- Kur krahason prodhimin me shitjet, thekso diferencën (mbetje = prodhim - shitje) dhe sinjalizo ditët/javët me mbetje të madhe ose me kthime të larta.
- Nëse përdoruesi nuk cakton periudhë, jep javët/ditët e fundit me të dhëna (deri në 8 javët ose 14 ditët e fundit).

TË DHËNAT (JSON):
- "currency": monedha (LEK).
- "note": shpjegim i periudhës që mbulojnë të dhënat.
- "products": produktet aktive me çmim bazë dhe kategori.
- "production": prodhimi ditor (nga Prodhimi Ditor), me "items" dhe "total" (vetëm ditët e fundit).
- "returns": sasitë e kthyera për çdo ditë (vetëm ditët e fundit).
- "daily": përmbledhje ditore e gatshme për krahasime — për çdo ditë: "productionQty" (sasia e prodhuar), "salesQty" (sasia e shitur/dërguar neto), "salesRevenue" (të ardhurat nga dërgesat), "returnsQty" (sasia e kthyer), "shopRevenue" (të ardhurat nga dyqani).
- SHËNIM: nuk ka listë të dërgesave/shitjeve një nga një. Për shitjet/të ardhurat/klientët/shpërndarësit përdor "daily", "weekly" dhe "summaries".
- "weekly": e njëjta përmbledhje por sipas javës (java fillon të hënën). Ka "weekStart" (data e së hënës), "weekLabel" (p.sh. "15/09 - 21/09") dhe të njëjtat fusha si te "daily".
- "summaries": përmbledhje të gatshme e të renditura:
  - "salesByProduct": produktet sipas sasisë e të ardhurave nga dërgesat (produkti më i shitur = i pari).
  - "salesByDistributor": shpërndarësit sipas të ardhurave (shpërndarësi me më shumë shitje = i pari).
  - "salesByClient": klientët sipas të ardhurave, me "paid"/"unpaid" (borxhi = unpaid).
  - "shopSalesByProduct" dhe "shopSalesBySeller": e njëjta logjikë për dyqanin.
  - "totals": të ardhurat totale nga dërgesat (deliveryRevenue), sa janë paguar (deliveryPaid), sa mbeten pa paguar (deliveryUnpaid), të ardhurat nga dyqani (shopRevenue) dhe totali i përgjithshëm (grandTotalRevenue).
- "clientDetails": SHFAQET VETËM kur pyetja përmend një klient specifik. Për secilin klient të përmendur jep: "totals" (revenue, paid, unpaid, quantity, deliveries), "weekly" (të ardhura e sasi javë pas jave për atë klient), "byProduct" (sa nga çdo produkt ka marrë ai klient) dhe "recentDeliveries" (dërgesat e fundit të detajuara). PËRDOR këtë kur pyetesh për një klient të caktuar ose kur krahason klientë.
- Nëse përdoruesi pyet për një klient specifik por "clientDetails" mungon ose është bosh, do të thotë që emri i klientit nuk u njoh — kërko nga përdoruesi ta shkruajë emrin saktë siç është në sistem.

JSON:
${JSON.stringify(data)}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...(Array.isArray(history)
      ? history
          .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
          .slice(-10)
      : []),
    { role: 'user', content: message },
  ];

  try {
    const resp = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.2,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('OpenAI error:', resp.status, errText);
      res.status(502).json({ message: 'Gabim nga shërbimi AI. Provo përsëri.' });
      return;
    }

    const json = (await resp.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const answer = json.choices?.[0]?.message?.content?.trim() || 'Nuk munda të gjeneroj përgjigje.';
    res.json({ answer });
  } catch (err) {
    console.error('AI request failed:', err);
    res.status(500).json({ message: 'Gabim gjatë komunikimit me AI.' });
  }
}
