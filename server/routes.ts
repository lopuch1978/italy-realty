import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { scrapeProperties, initScraper } from "./scraper";

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Initialize with demo data on startup
  await initScraper();

  // GET /api/properties — with optional filters
  app.get("/api/properties", async (req, res) => {
    try {
      const { region, hasPool, hasGuesthouse, hasGarden, priceMin, priceMax, onlyNew } = req.query;

      let all = await storage.getAllProperties();

      // Filter by region
      if (region && region !== "all") {
        const regionStr = region as string;
        all = all.filter(p =>
          regionStr === "toscana"
            ? p.region.toLowerCase().includes("tosc")
            : p.region.toLowerCase().includes("tirolo") || p.region.toLowerCase().includes("alto adige") || p.region.toLowerCase().includes("trentino")
        );
      }

      // Filter pool
      if (hasPool === "true") {
        all = all.filter(p => p.hasPool === true);
      }

      // Filter guesthouse
      if (hasGuesthouse === "true") {
        all = all.filter(p => p.hasGuesthouse === true);
      }

      // Filter garden
      if (hasGarden === "true") {
        all = all.filter(p => p.hasGarden === true);
      }

      // Filter price range
      if (priceMin) {
        all = all.filter(p => p.price == null || p.price >= parseInt(priceMin as string));
      }
      if (priceMax) {
        all = all.filter(p => p.price == null || p.price <= parseInt(priceMax as string));
      }

      // Only new
      if (onlyNew === "true") {
        all = all.filter(p => p.isNew === true);
      }

      res.json(all);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/properties/:id
  app.get("/api/properties/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const prop = await storage.getPropertyById(id);
    if (!prop) return res.status(404).json({ error: "Not found" });
    res.json(prop);
  });

  // POST /api/scrape — trigger manual scrape
  app.post("/api/scrape", async (req, res) => {
    const log = await storage.createScrapeLog({ status: "running", newListings: 0, totalListings: 0 });
    res.json({ message: "Scrape started", logId: log.id });

    // Run async
    (async () => {
      try {
        const { newCount, totalCount } = await scrapeProperties();
        await storage.updateScrapeLog(log.id, {
          status: "success",
          finishedAt: new Date(),
          newListings: newCount,
          totalListings: totalCount,
        });
      } catch (err: any) {
        await storage.updateScrapeLog(log.id, {
          status: "error",
          finishedAt: new Date(),
          errorMessage: err.message,
        });
      }
    })();
  });

  // POST /api/properties/mark-seen — mark all as seen
  app.post("/api/properties/mark-seen", async (_req, res) => {
    await storage.markAllAsSeen();
    res.json({ success: true });
  });

  // GET /api/scrape-logs — last scrape info
  app.get("/api/scrape-logs", async (_req, res) => {
    const logs = await storage.getAllScrapeLogs();
    res.json(logs.slice(0, 10));
  });

  // GET /api/stats — quick summary
  app.get("/api/stats", async (_req, res) => {
    const all = await storage.getAllProperties();
    const newCount = all.filter(p => p.isNew).length;
    const withPool = all.filter(p => p.hasPool).length;
    const withGuesthouse = all.filter(p => p.hasGuesthouse).length;
    const toscana = all.filter(p => p.region.toLowerCase().includes("tosc")).length;
    const tirolo = all.filter(p => !p.region.toLowerCase().includes("tosc")).length;
    const latestLog = await storage.getLatestScrapeLog();

    res.json({
      total: all.length,
      newCount,
      withPool,
      withGuesthouse,
      toscana,
      tirolo,
      lastScrape: latestLog?.finishedAt || latestLog?.startedAt || null,
      lastScrapeStatus: latestLog?.status || null,
    });
  });

  return httpServer;
}
