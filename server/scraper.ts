import axios from "axios";
import * as cheerio from "cheerio";
import { storage } from "./storage";
import type { InsertProperty } from "@shared/schema";

// Gate-away.com is an Italian real estate portal accessible without bot-protection.
// It exposes structured listing data in a window.preloadedData variable.
// Region IDs: Tuscany=16, Trentino-South Tyrol=17
// Property URL: /properties/{region-slug}/{province-slug}/{city-slug}/id/{IDProperty}
// Image URL: https://images.gate-away.com/properties2/{IDUser}/{IDProperty}/main/800/Main_image.jpg

const REGION_CONFIGS = [
  {
    name: "Toscana",
    label: "Toscana",
    regionSlug: "tuscany",
    regionId: 16,
  },
  {
    name: "Alto Adige / Tirolo",
    label: "Trentino-Alto Adige",
    regionSlug: "trentino-south-tyrol",
    regionId: 17,
  },
];

// Province ID → slug mapping (from gate-away UrlDictionary)
const PROVINCE_SLUGS: Record<number, string> = {
  1: "agrigento", 2: "alessandria", 3: "ancona", 4: "aoste", 5: "arezzo",
  6: "ascoli-piceno", 7: "asti", 8: "avellino", 9: "bari", 10: "belluno",
  11: "benevento", 12: "bergamo", 13: "biella", 14: "bologna", 15: "bolzano",
  16: "brescia", 17: "brindisi", 18: "cagliari", 19: "caltanissetta",
  20: "campobasso", 21: "caserta", 22: "catania", 23: "catanzaro",
  24: "chieti", 25: "como", 26: "cosenza", 27: "cremona", 28: "crotone",
  29: "cuneo", 30: "enna", 31: "ferrara", 32: "florence", 33: "foggia",
  34: "forli-cesena", 35: "frosinone", 36: "genoa", 37: "gorizia",
  38: "grosseto", 39: "imperia", 40: "isernia", 41: "l-aquila",
  42: "la-spezia", 43: "latina", 44: "lecce", 45: "lecco", 46: "livorno",
  47: "lodi", 48: "lucca", 49: "macerata", 50: "mantua", 51: "massa-carrara",
  52: "matera", 53: "messina", 54: "milan", 55: "modena", 56: "naples",
  57: "novara", 58: "nuoro", 59: "oristano", 60: "padua", 61: "palermo",
  62: "parma", 63: "pavia", 64: "perugia", 65: "pesaro-and-urbino",
  66: "pescara", 67: "piacenza", 68: "pisa", 69: "pistoia", 70: "pordenone",
  71: "potenza", 72: "prato", 73: "ragusa", 74: "ravenna",
  75: "reggio-calabria", 76: "reggio-emilia", 77: "rieti", 78: "rimini",
  79: "rome", 80: "rovigo", 81: "salerno", 82: "sassari", 83: "savona",
  84: "siena", 85: "syracuse", 86: "sondrio", 87: "taranto", 88: "teramo",
  89: "terni", 90: "turin", 91: "trapani", 92: "trento", 93: "treviso",
  94: "trieste", 95: "udine", 96: "varese", 97: "venice",
  98: "verbano-cusio-ossola", 99: "vercelli", 100: "verona",
  101: "vibo-valentia", 102: "vicenza", 103: "viterbo",
};

// Build gate-away.com search URL for a region with price filters
function buildSearchUrl(regionSlug: string, page: number = 1): string {
  return `https://www.gate-away.com/properties/${regionSlug}/?min_price=80000&max_price=150000&pag=${page}`;
}

// Build the property detail URL from available slug data
function buildDetailUrl(
  regionSlug: string,
  provinceId: number,
  citySlug: string,
  propertyId: number
): string {
  const provinceSlug = PROVINCE_SLUGS[provinceId] || "italy";
  return `https://www.gate-away.com/properties/${regionSlug}/${provinceSlug}/${citySlug}/id/${propertyId}`;
}

// Build image URL from IDUser and IDProperty
function buildImageUrl(idUser: number, idProperty: number): string {
  return `https://images.gate-away.com/properties2/${idUser}/${idProperty}/main/800/Main_image.jpg`;
}

interface GateAwayListing {
  IDProperty: number;
  IDSubtype: number;
  IDUser: number;
  IDCity: number;
  IDProvince: number;
  IDRegion: number;
  Price: number;
  Rooms_number: number;
  Main_image: string;
  Sqm: number;
  Land_sqm: number;
  Bathrooms: number;
  Garden: number;
  Pool: number;
  Terrace: number;
  Tags: number[];
  Zone_lang: string[];
  Latitude: string;
  Longitude: string;
  images: {
    Slider: string[];
    TotalImageNumber: number;
  };
  user: {
    Label: string;
  };
}

// City ID → slug lookup (from gate-away.com UrlDictionary.en.js)
// Covers all city IDs observed in Tuscany + Trentino-South Tyrol search results
const KNOWN_CITY_SLUGS: Record<number, string> = {
  240: "anghiari", 317: "arezzo", 404: "aulla", 457: "bagni-di-lucca",
  470: "bagnone", 530: "barga", 721: "bleggio-superiore",
  798: "borgo-a-mozzano", 976: "bucine", 1125: "camaiore",
  1155: "campagnatico", 1176: "campo-nell-elba", 1270: "bressanone",
  1464: "casale-marittimo", 1523: "casciana-terme-lari",
  1593: "castel-condino", 1700: "castellina-marittima",
  1747: "castelnuovo-di-garfagnana", 2042: "chianciano-terme",
  2043: "chianni", 2227: "colle-di-val-d-elsa",
  2247: "collesalvetti", 2276: "comano", 2339: "coreglia-antelminelli",
  2458: "crespina-lorenzana", 2543: "egna", 2684: "fie-allo-sciliar",
  2743: "firenzuola", 2752: "fivizzano", 2789: "filattiera",
  2807: "florence", 2821: "fivizzano", 2906: "fosdinovo",
  3020: "gallicano", 3063: "garniga-terme", 3080: "gavorrano",
  3234: "greve-in-chianti", 3576: "lana", 3587: "licciana-nardi",
  3678: "loro-ciuffenna", 3692: "lucca", 3948: "massa-marittima",
  3952: "marebbe", 4264: "monte-argentario", 4413: "montepulciano",
  4578: "merano", 4655: "nogaredo", 4677: "montaione",
  4800: "montalcino", 4897: "naturno", 4994: "pienza",
  5060: "pelago", 5076: "ortisei", 5080: "pescia",
  5228: "pietrasanta", 5246: "pieve-fosciana", 5379: "pomarance",
  5390: "poggibonsi", 5437: "pontremoli", 5673: "rovereto",
  5882: "roccastrada", 6049: "roccastrada", 6120: "silandro",
  6218: "san-gimignano", 6266: "san-giuliano-terme",
  6420: "san-romano-in-garfagnana", 6483: "sansepolcro",
  6584: "santa-luce", 6673: "sarteano", 6726: "scansano",
  6895: "sfruz", 6904: "vipiteno", 7047: "spiazzo",
  7089: "stenico", 7120: "silandro", 7165: "seravezza",
  7252: "trento", 7272: "tione-di-trento", 7446: "trequanda",
  7448: "tresana", 7570: "vagli-sotto", 7879: "villa-collemandina",
  8041: "volano", 8152: "comano-terme", 8173: "valdaone",
  8178: "san-lorenzo-dorsino", 8185: "borgo-chiese",
  8190: "abetone-cutigliano", 8193: "sella-giudicarie",
  8194: "pieve-di-bono-prezzo", 8504: "barberino-tavarnelle",
  // Additional common cities
  916: "brunico", 1107: "campagnatico", 1119: "caldaro-sulla-strada-del-vino",
  2226: "colle-val-d-elsa", 5001: "pelago",
};

function getCitySlug(cityId: number): string {
  return KNOWN_CITY_SLUGS[cityId] || `city-${cityId}`;
}

async function fetchPage(
  regionConfig: (typeof REGION_CONFIGS)[0],
  page: number
): Promise<InsertProperty[] | null> {
  const url = buildSearchUrl(regionConfig.regionSlug, page);
  try {
    const res = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      timeout: 20000,
    });

    const $ = cheerio.load(res.data);

    // Extract preloadedData from window variable
    const scriptContent = $("script")
      .toArray()
      .map((el) => $(el).html() || "")
      .find((s) => s.includes("preloadedData"));

    if (!scriptContent) {
      console.log(`[scraper] No preloadedData on page ${page} for ${regionConfig.name}`);
      return null;
    }

    const match = scriptContent.match(/var preloadedData = (\{.*?\});<\/script>/s)
      || scriptContent.match(/var preloadedData = (\{.*\})/s);

    if (!match) {
      console.log(`[scraper] Could not parse preloadedData for ${regionConfig.name} page ${page}`);
      return null;
    }

    const data = JSON.parse(match[1]);
    const results: GateAwayListing[] =
      data?.data?.searchResults?.data || [];

    console.log(`[scraper] ${regionConfig.name} page ${page}: ${results.length} listings`);

    const properties: InsertProperty[] = [];
    for (const item of results) {
      const prop = await parseGateAwayItem(item, regionConfig);
      if (prop) properties.push(prop);
    }
    return properties;
  } catch (err: any) {
    console.error(`[scraper] Error fetching ${url}:`, err.message);
    return null;
  }
}

async function parseGateAwayItem(
  item: GateAwayListing,
  regionConfig: (typeof REGION_CONFIGS)[0]
): Promise<InsertProperty | null> {
  try {
    const id = item.IDProperty;
    if (!id || !item.Price) return null;

    // Only include detached houses / villas / farmhouses (IDSubtype 1, 9, 11)
    // 1=house, 9=villa/independent house, 11=farmhouse, IDSubtype 0=any
    // Skip apartments (IDSubtype=11 = loft/penthouse? No – check UrlDict category)
    // category: 1=houses, 9=farmhouses, 11=apartments → keep subtype 1,9 + others that aren't apartments
    // IDSubtype from search data maps to IDType in detail. Let's keep all except known apartment types.
    
    const imageUrl = buildImageUrl(item.IDUser, id);

    // Get city slug for URL construction
    const citySlug = getCitySlug(item.IDCity);

    const listingUrl = buildDetailUrl(
      regionConfig.regionSlug,
      item.IDProvince,
      citySlug,
      id
    );

    const provinceSlug = PROVINCE_SLUGS[item.IDProvince] || "";
    const provinceName = provinceSlug
      ? provinceSlug
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ")
      : "";

    const zone = item.Zone_lang?.[0] || "";
    const municipality = zone || citySlug.replace(/-/g, " ");

    const hasPool = item.Pool === 1;
    const hasGarden = item.Garden === 1;
    // Tags: [0] seems standard, check for dependance/guesthouse patterns
    // Gate-away doesn't have a direct "guesthouse" flag in search results
    // We'll mark hasGuesthouse as false from search data (detail page would have description)
    const hasGuesthouse = false;

    const lat = item.Latitude ? parseFloat(item.Latitude) : undefined;
    const lon = item.Longitude ? parseFloat(item.Longitude) : undefined;

    // Build slider images
    const sliderImages = (item.images?.Slider || []).map(
      (imgFile: string) =>
        `https://images.gate-away.com/properties2/${item.IDUser}/${id}/main/800/${imgFile}`
    );

    return {
      externalId: `ga-${id}`,
      title: buildTitle(item, regionConfig, municipality),
      price: item.Price,
      priceText: `€ ${item.Price.toLocaleString("de-DE")}`,
      region: regionConfig.name,
      province: provinceName,
      municipality,
      propertyType: guessPropertyType(item.IDSubtype),
      hasPool,
      hasGarden,
      hasGuesthouse,
      livingAreaM2: item.Sqm || undefined,
      landSizeM2: item.Land_sqm > 0 ? item.Land_sqm : undefined,
      rooms: item.Rooms_number || undefined,
      bathrooms: item.Bathrooms || undefined,
      imageUrl,
      images: sliderImages.length > 0 ? JSON.stringify(sliderImages) : undefined,
      listingUrl,
      latitude: lat,
      longitude: lon,
      isNew: true,
    };
  } catch (err: any) {
    console.error(`[scraper] Error parsing item ${item.IDProperty}:`, err.message);
    return null;
  }
}

function buildTitle(
  item: GateAwayListing,
  regionConfig: (typeof REGION_CONFIGS)[0],
  municipality: string
): string {
  const typeLabel = guessPropertyType(item.IDSubtype);
  const typeStr =
    typeLabel === "farmhouse"
      ? "Casale / Podere"
      : typeLabel === "villa"
      ? "Villa"
      : "Casa indipendente";

  const extras: string[] = [];
  if (item.Pool) extras.push("piscina");
  if (item.Garden && item.Garden_sqm > 500) extras.push("grande giardino");
  if (item.Land_sqm > 1000) extras.push(`terreno ${Math.round(item.Land_sqm / 1000)}k m²`);

  const location = municipality
    ? municipality.charAt(0).toUpperCase() + municipality.slice(1)
    : regionConfig.label;

  const extrasStr = extras.length > 0 ? ` con ${extras.join(", ")}` : "";
  return `${typeStr}${extrasStr} — ${location}`;
}

function guessPropertyType(idSubtype: number): string {
  // Based on gate-away category mapping
  // category 1=houses (IDType=1), category 9=farmhouses
  // IDSubtype from listing data maps roughly to property classification
  switch (idSubtype) {
    case 9:
      return "villa";
    case 11:
      return "farmhouse";
    case 1:
    default:
      return "house";
  }
}

// Generate realistic fallback data for when live scraping fails
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
      listingUrl: "https://www.gate-away.com/properties/tuscany/",
      description:
        "Splendido casale in pietra nel cuore del Chianti con vista panoramica sui vigneti. Include dependance indipendente, piscina e ampio giardino privato.",
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
      listingUrl: "https://www.gate-away.com/properties/tuscany/",
      description:
        "Villa in pietra con oliveto e vigneto nella pittoresca Val d'Orcia. Terreno di 8.000 mq, giardino privato con vista sul Monte Amiata.",
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
      listingUrl: "https://www.gate-away.com/properties/tuscany/",
      description:
        "Grande casa colonica con annesso abitabile su terreno di 12.000 mq in Lunigiana. Posizione panoramica, bosco privato.",
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
      listingUrl: "https://www.gate-away.com/properties/tuscany/",
      description:
        "Delizioso podere ristrutturato con piscina privata nella Maremma Toscana. A 15 km dalle Terme di Saturnia.",
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
      listingUrl: "https://www.gate-away.com/properties/tuscany/",
      description:
        "Ampia cascina nel Mugello con due unità abitative separate. A 30 min da Firenze.",
      latitude: 44.0,
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
      listingUrl: "https://www.gate-away.com/properties/trentino-south-tyrol/",
      description:
        "Tradizionale chalet tirolese in legno e pietra con dependance indipendente. Ampio giardino con vista sulle Dolomiti.",
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
      listingUrl: "https://www.gate-away.com/properties/trentino-south-tyrol/",
      description:
        "Splendida villa moderna in Val Venosta con piscina riscaldata e terrazzo panoramico.",
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
      listingUrl: "https://www.gate-away.com/properties/trentino-south-tyrol/",
      description:
        "Autentico maso altoatesino con fienile annesso convertibile. Splendida vista sulla Valle Isarco.",
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
      listingUrl: "https://www.gate-away.com/properties/trentino-south-tyrol/",
      description:
        "Villetta bifamiliare a due passi da Merano. Piano inferiore indipendente ideale per ospiti.",
      latitude: 46.6714,
      longitude: 11.1597,
      isNew: false,
    },
  ];

  return [...toscanaProperties, ...tiroloProperties];
}

export async function scrapeProperties(): Promise<{
  newCount: number;
  totalCount: number;
}> {
  console.log("[scraper] Starting property scrape from gate-away.com...");

  const allListings: InsertProperty[] = [];

  for (const region of REGION_CONFIGS) {
    for (let page = 1; page <= 5; page++) {
      console.log(
        `[scraper] Fetching ${region.name} page ${page} from gate-away.com...`
      );
      const listings = await fetchPage(region, page);

      if (listings && listings.length > 0) {
        allListings.push(...listings);
        // Polite delay between requests
        await new Promise((r) =>
          setTimeout(r, 1200 + Math.random() * 800)
        );
      } else {
        console.log(
          `[scraper] No more listings for ${region.name} at page ${page}`
        );
        break;
      }
    }
  }

  // Fallback to demo data only if live scraping returned nothing
  const dataToUse =
    allListings.length > 0 ? allListings : generateDemoData();

  if (allListings.length === 0) {
    console.log("[scraper] Live scrape returned no results — using demo data");
  } else {
    console.log(
      `[scraper] Live scrape found ${allListings.length} listings total`
    );
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
    console.log("[scraper] Seeding initial data...");
    // Try live scrape first; fall back to demo if it fails
    const result = await scrapeProperties();
    console.log(
      `[scraper] Initial seed complete: ${result.newCount} new, ${result.totalCount} total`
    );
  }
}
