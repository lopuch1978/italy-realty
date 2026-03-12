import axios from "axios";
import * as cheerio from "cheerio";
import { storage } from "./storage";
import type { InsertProperty } from "@shared/schema";

// Immobiliare.it search URL builder for buy operations
// Regions: Toscana (ID 9) and Trentino-Alto Adige/Südtirol (ID 5)
// We use their public search API endpoint

const REGIONS: { name: string; id: string; label: string }[] = [
  { name: "Toscana", id: "9", label: "Toscana" },
  { name: "Alto Adige / Tirolo", id: "5", label: "Trentino-Alto Adige" },
];

const FILTERS = {
  minPrice: 80000,
  maxPrice: 150000,
  propertyType: "house",
  garden: ["private"],
  pool: false, // toggled by user filter on frontend
};

function buildSearchUrl(regionId: string, page: number = 1, pool: boolean = false): string {
  const params = new URLSearchParams({
    categoria: "1",
    contratto: "1", // vendita (buy)
    tipologia: "4", // villa/casa indipendente
    idRegione: regionId,
    prezzoMinimo: FILTERS.minPrice.toString(),
    prezzoMassimo: FILTERS.maxPrice.toString(),
    giardino: "1", // private garden
    pag: page.toString(),
  });
  if (pool) params.set("piscina", "1");
  return `https://www.immobiliare.it/vendita-case/?${params.toString()}`;
}

async function fetchPage(url: string): Promise<any[] | null> {
  try {
    const res = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "it-IT,it;q=0.9,en;q=0.8",
        "Referer": "https://www.immobiliare.it/",
      },
      timeout: 15000,
    });

    const $ = cheerio.load(res.data);
    const listings: InsertProperty[] = [];

    // Extract __NEXT_DATA__ JSON from Next.js app
    const nextDataScript = $("#__NEXT_DATA__").html();
    if (nextDataScript) {
      try {
        const data = JSON.parse(nextDataScript);
        const results = data?.props?.pageProps?.dehydratedState?.queries?.[0]?.state?.data?.results
          || data?.props?.pageProps?.results
          || [];

        for (const item of results) {
          const listing = parseImmobiliareItem(item);
          if (listing) listings.push(listing);
        }
        return listings;
      } catch {
        // fallback to HTML parsing
      }
    }

    // HTML fallback parsing
    $("li[data-item-id]").each((_, el) => {
      const id = $(el).attr("data-item-id");
      if (!id) return;

      const title = $(el).find(".in-listingCardTitle").text().trim() || $(el).find("h2").text().trim();
      const priceText = $(el).find(".in-listingCardPrice").text().trim() || $(el).find("[class*='price']").first().text().trim();
      const price = parseInt(priceText.replace(/[^0-9]/g, "")) || undefined;
      const href = $(el).find("a[href*='/annunci/']").first().attr("href");
      const img = $(el).find("img").first().attr("src") || $(el).find("img").first().attr("data-src");
      const location = $(el).find(".in-listingCardSubtitle").text().trim() || $(el).find("[class*='location']").first().text().trim();
      const hasPool = $(el).text().toLowerCase().includes("piscin");
      const hasGarden = $(el).text().toLowerCase().includes("giardino");

      if (id && href) {
        listings.push({
          externalId: `imm-${id}`,
          title: title || `Immobile ${id}`,
          price: price,
          priceText: priceText,
          region: "Unknown",
          municipality: location,
          listingUrl: href.startsWith("http") ? href : `https://www.immobiliare.it${href}`,
          imageUrl: img,
          hasPool,
          hasGarden,
          hasGuesthouse: false,
          isNew: true,
        });
      }
    });

    return listings;
  } catch (err: any) {
    console.error(`[scraper] Error fetching ${url}:`, err.message);
    return null;
  }
}

function parseImmobiliareItem(item: any): InsertProperty | null {
  try {
    const id = item.realEstate?.id || item.id;
    if (!id) return null;

    const title = item.realEstate?.title || item.title || "Immobile";
    const priceRaw = item.realEstate?.price?.value?.raw || item.price?.raw;
    const priceText = item.realEstate?.price?.value?.normalizedValue || item.price?.normalizedValue;
    const geo = item.realEstate?.location || item.location || {};
    const features = item.realEstate?.features || item.features || [];
    const media = item.realEstate?.multimedia?.photos || item.multimedia?.photos || [];
    const desc = item.realEstate?.description || item.description || "";

    const featureText = (Array.isArray(features) ? features.join(" ") : JSON.stringify(features)).toLowerCase();
    const descLower = desc.toLowerCase();

    const hasPool = featureText.includes("piscin") || descLower.includes("piscin") || item.realEstate?.hasPool === true;
    const hasGarden = featureText.includes("giardino") || descLower.includes("giardino") || featureText.includes("garden");
    const hasGuesthouse = featureText.includes("dependance") || descLower.includes("dependance") || descLower.includes("casetta") || descLower.includes("annesso");

    const images = media.map((p: any) => p.urls?.large || p.urls?.medium || p.url).filter(Boolean);
    const imageUrl = images[0];

    const province = geo.province?.name || geo.provinceName || "";
    const municipality = geo.city?.name || geo.cityName || geo.municipality?.name || "";
    const lat = geo.latitude || geo.lat;
    const lon = geo.longitude || geo.lng || geo.lon;

    // Determine region label from province or region field
    const regionName = geo.region?.name || geo.regionName || "";
    let region = "Toscana";
    if (regionName.toLowerCase().includes("trentino") || regionName.toLowerCase().includes("alto adige") || regionName.toLowerCase().includes("südtirol")) {
      region = "Alto Adige / Tirolo";
    }

    return {
      externalId: `imm-${id}`,
      title,
      price: priceRaw ? parseInt(priceRaw) : undefined,
      priceText: priceText || undefined,
      region,
      province,
      municipality,
      address: geo.address || undefined,
      propertyType: "house",
      hasPool,
      hasGarden,
      hasGuesthouse,
      livingAreaM2: item.realEstate?.surface || undefined,
      rooms: item.realEstate?.rooms || undefined,
      bedrooms: item.realEstate?.bedRoomsNumber || undefined,
      bathrooms: item.realEstate?.bathRoomsNumber || undefined,
      imageUrl,
      images: images.length > 0 ? JSON.stringify(images) : undefined,
      listingUrl: item.realEstate?.url || `https://www.immobiliare.it/annunci/${id}/`,
      description: desc.slice(0, 1000),
      latitude: lat ? parseFloat(lat) : undefined,
      longitude: lon ? parseFloat(lon) : undefined,
      isNew: true,
    };
  } catch {
    return null;
  }
}

// Generate realistic mock/demo data for when scraping fails or returns no results
function generateDemoData(): InsertProperty[] {
  const toscanaProperties: InsertProperty[] = [
    {
      externalId: "demo-tosc-1",
      title: "Casale con piscina e dependance — Chianti",
      price: 145000,
      priceText: "€ 145.000",
      region: "Toscana",
      province: "Siena",
      municipality: "Castelnuovo Berardenga",
      propertyType: "farmhouse",
      hasPool: true,
      hasGarden: true,
      hasGuesthouse: true,
      livingAreaM2: 180,
      landSizeM2: 5000,
      rooms: 7,
      bedrooms: 4,
      bathrooms: 2,
      condition: "Da ristrutturare",
      imageUrl: "https://images.unsplash.com/photo-1523531294919-4bcd7c65e216?w=800",
      listingUrl: "https://www.immobiliare.it/annunci/demo-tosc-1/",
      description: "Splendido casale in pietra nel cuore del Chianti con vista panoramica sui vigneti. Include dependance indipendente, piscina e ampio giardino privato. Ideale come residenza principale o struttura turistica.",
      latitude: 43.4167,
      longitude: 11.4833,
      isNew: true,
    },
    {
      externalId: "demo-tosc-2",
      title: "Villa rustica con oliveto — Val d'Orcia",
      price: 138000,
      priceText: "€ 138.000",
      region: "Toscana",
      province: "Siena",
      municipality: "Pienza",
      propertyType: "house",
      hasPool: false,
      hasGarden: true,
      hasGuesthouse: false,
      livingAreaM2: 155,
      landSizeM2: 8000,
      rooms: 6,
      bedrooms: 3,
      bathrooms: 2,
      condition: "Buono",
      imageUrl: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800",
      listingUrl: "https://www.immobiliare.it/annunci/demo-tosc-2/",
      description: "Villa in pietra con oliveto e vigneto nella pittoresca Val d'Orcia. Terreno di 8.000 mq, giardino privato con vista sul Monte Amiata. Struttura ben mantenuta pronta all'abitazione.",
      latitude: 43.0795,
      longitude: 11.6786,
      isNew: true,
    },
    {
      externalId: "demo-tosc-3",
      title: "Casa colonica con annesso — Lunigiana",
      price: 89000,
      priceText: "€ 89.000",
      region: "Toscana",
      province: "Massa-Carrara",
      municipality: "Mulazzo",
      propertyType: "farmhouse",
      hasPool: false,
      hasGarden: true,
      hasGuesthouse: true,
      livingAreaM2: 210,
      landSizeM2: 12000,
      rooms: 9,
      bedrooms: 5,
      bathrooms: 3,
      condition: "Da ristrutturare",
      imageUrl: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800",
      listingUrl: "https://www.immobiliare.it/annunci/demo-tosc-3/",
      description: "Grande casa colonica con annesso abitabile su terreno di 12.000 mq in Lunigiana. Posizione panoramica, bosco privato, ottimo potenziale per agriturismo. Prezzo interessante per chi cerca spazio.",
      latitude: 44.3108,
      longitude: 9.8928,
      isNew: true,
    },
    {
      externalId: "demo-tosc-4",
      title: "Podere con piscina — Maremma Toscana",
      price: 149000,
      priceText: "€ 149.000",
      region: "Toscana",
      province: "Grosseto",
      municipality: "Manciano",
      propertyType: "farmhouse",
      hasPool: true,
      hasGarden: true,
      hasGuesthouse: false,
      livingAreaM2: 130,
      landSizeM2: 7000,
      rooms: 5,
      bedrooms: 3,
      bathrooms: 2,
      condition: "Ottimo",
      imageUrl: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800",
      listingUrl: "https://www.immobiliare.it/annunci/demo-tosc-4/",
      description: "Delizioso podere ristrutturato con piscina privata nella Maremma Toscana. A 15 km dalle Terme di Saturnia, panorama mozzafiato. Ideale come casa vacanze di lusso o investimento turistico.",
      latitude: 42.5894,
      longitude: 11.5097,
      isNew: false,
    },
    {
      externalId: "demo-tosc-5",
      title: "Cascina con due unità abitative — Mugello",
      price: 112000,
      priceText: "€ 112.000",
      region: "Toscana",
      province: "Firenze",
      municipality: "Borgo San Lorenzo",
      propertyType: "farmhouse",
      hasPool: false,
      hasGarden: true,
      hasGuesthouse: true,
      livingAreaM2: 260,
      landSizeM2: 9500,
      rooms: 10,
      bedrooms: 5,
      bathrooms: 4,
      condition: "Da ristrutturare",
      imageUrl: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800",
      listingUrl: "https://www.immobiliare.it/annunci/demo-tosc-5/",
      description: "Ampia cascina nel Mugello con due unità abitative separate. Contesto rurale tranquillo, terreno agricolo con castagneto. Perfetta per famiglia allargata o ospiti. A 30 min da Firenze.",
      latitude: 44.0000,
      longitude: 11.3833,
      isNew: false,
    },
  ];

  const tiroloProperties: InsertProperty[] = [
    {
      externalId: "demo-tiro-1",
      title: "Chalet con giardino e dépendance — Val Pusteria",
      price: 148000,
      priceText: "€ 148.000",
      region: "Alto Adige / Tirolo",
      province: "Bolzano",
      municipality: "Brunico",
      propertyType: "house",
      hasPool: false,
      hasGarden: true,
      hasGuesthouse: true,
      livingAreaM2: 190,
      landSizeM2: 3500,
      rooms: 8,
      bedrooms: 4,
      bathrooms: 3,
      condition: "Buono",
      imageUrl: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=800",
      listingUrl: "https://www.immobiliare.it/annunci/demo-tiro-1/",
      description: "Tradizionale chalet tirolese in legno e pietra con dependance indipendente. Ampio giardino recintato con vista sulle Dolomiti. Vicino agli impianti sciistici Plan de Corones. Struttura in ottime condizioni.",
      latitude: 46.7959,
      longitude: 11.9352,
      isNew: true,
    },
    {
      externalId: "demo-tiro-2",
      title: "Casa di montagna con piscina — Val Venosta",
      price: 143000,
      priceText: "€ 143.000",
      region: "Alto Adige / Tirolo",
      province: "Bolzano",
      municipality: "Silandro",
      propertyType: "house",
      hasPool: true,
      hasGarden: true,
      hasGuesthouse: false,
      livingAreaM2: 165,
      landSizeM2: 4200,
      rooms: 7,
      bedrooms: 4,
      bathrooms: 2,
      condition: "Ottimo",
      imageUrl: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800",
      listingUrl: "https://www.immobiliare.it/annunci/demo-tiro-2/",
      description: "Splendida villa moderna in Val Venosta con piscina riscaldata e terrazzo panoramico. Zona soleggiata nota per la coltivazione di mele. A 5 min dal centro, collegamento ottimale a Merano.",
      latitude: 46.6299,
      longitude: 10.7752,
      isNew: true,
    },
    {
      externalId: "demo-tiro-3",
      title: "Maso tradizionale con fienile — Valle Isarco",
      price: 95000,
      priceText: "€ 95.000",
      region: "Alto Adige / Tirolo",
      province: "Bolzano",
      municipality: "Chiusa",
      propertyType: "farmhouse",
      hasPool: false,
      hasGarden: true,
      hasGuesthouse: false,
      livingAreaM2: 220,
      landSizeM2: 6000,
      rooms: 8,
      bedrooms: 4,
      bathrooms: 2,
      condition: "Da ristrutturare",
      imageUrl: "https://images.unsplash.com/photo-1480074568708-e7b720bb3f09?w=800",
      listingUrl: "https://www.immobiliare.it/annunci/demo-tiro-3/",
      description: "Autentico maso altoatesino con fienile annesso convertibile in unità abitativa supplementare. Ampio terreno con frutteto e orto. Splendida vista sulla Valle Isarco. Da ristrutturare secondo gusto personale.",
      latitude: 46.6403,
      longitude: 11.5693,
      isNew: false,
    },
    {
      externalId: "demo-tiro-4",
      title: "Villetta bifamiliare — Merano e dintorni",
      price: 128000,
      priceText: "€ 128.000",
      region: "Alto Adige / Tirolo",
      province: "Bolzano",
      municipality: "Merano",
      propertyType: "house",
      hasPool: false,
      hasGarden: true,
      hasGuesthouse: true,
      livingAreaM2: 175,
      landSizeM2: 2800,
      rooms: 7,
      bedrooms: 3,
      bathrooms: 3,
      condition: "Buono",
      imageUrl: "https://images.unsplash.com/photo-1571055107559-3e67626fa8be?w=800",
      listingUrl: "https://www.immobiliare.it/annunci/demo-tiro-4/",
      description: "Villetta bifamiliare a due passi da Merano. Piano inferiore indipendente ideale per ospiti o affitto. Giardino curato con pergolato e orto. Città termale con clima mite, ottima qualità della vita.",
      latitude: 46.6714,
      longitude: 11.1597,
      isNew: false,
    },
  ];

  return [...toscanaProperties, ...tiroloProperties];
}

export async function scrapeProperties(): Promise<{ newCount: number; totalCount: number }> {
  console.log("[scraper] Starting property scrape...");

  const allListings: InsertProperty[] = [];

  // Try to fetch live data
  for (const region of REGIONS) {
    for (let page = 1; page <= 3; page++) {
      const url = buildSearchUrl(region.id, page, false);
      console.log(`[scraper] Fetching ${region.name} page ${page}: ${url}`);
      const listings = await fetchPage(url);

      if (listings && listings.length > 0) {
        // Tag with correct region
        const tagged = listings.map(l => ({ ...l, region: region.name }));
        allListings.push(...tagged);
        await new Promise(r => setTimeout(r, 1500 + Math.random() * 1000));
      } else {
        console.log(`[scraper] No listings from page ${page} for ${region.name}, stopping`);
        break;
      }
    }
  }

  // Use demo data if live scraping returned nothing
  const dataToUse = allListings.length > 0 ? allListings : generateDemoData();
  if (allListings.length === 0) {
    console.log("[scraper] Using demo data (live scrape returned no results)");
  }

  let newCount = 0;
  for (const listing of dataToUse) {
    const existing = await storage.getPropertyByExternalId(listing.externalId);
    if (!existing) newCount++;
    await storage.upsertProperty(listing);
  }

  const total = (await storage.getAllProperties()).length;
  console.log(`[scraper] Done. ${newCount} new, ${total} total.`);
  return { newCount, totalCount: total };
}

// Run initial scrape + seed demo data immediately on startup
export async function initScraper() {
  const existing = await storage.getAllProperties();
  if (existing.length === 0) {
    console.log("[scraper] Seeding initial demo data...");
    const demos = generateDemoData();
    for (const d of demos) {
      await storage.upsertProperty(d);
    }
  }
}
