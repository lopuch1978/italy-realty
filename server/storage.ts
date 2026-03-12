import { properties, scrapeLog, type Property, type InsertProperty, type ScrapeLog, type InsertScrapeLog } from "@shared/schema";

export interface IStorage {
  // Properties
  getAllProperties(): Promise<Property[]>;
  getPropertyById(id: number): Promise<Property | undefined>;
  getPropertyByExternalId(externalId: string): Promise<Property | undefined>;
  upsertProperty(data: InsertProperty): Promise<Property>;
  markAllAsSeen(): Promise<void>;
  deleteProperty(id: number): Promise<void>;

  // Scrape logs
  createScrapeLog(data: InsertScrapeLog): Promise<ScrapeLog>;
  updateScrapeLog(id: number, data: Partial<ScrapeLog>): Promise<ScrapeLog>;
  getLatestScrapeLog(): Promise<ScrapeLog | undefined>;
  getAllScrapeLogs(): Promise<ScrapeLog[]>;
}

export class MemStorage implements IStorage {
  private properties: Map<number, Property> = new Map();
  private scrapeLogs: Map<number, ScrapeLog> = new Map();
  private propIdCounter = 1;
  private logIdCounter = 1;

  async getAllProperties(): Promise<Property[]> {
    return Array.from(this.properties.values()).sort((a, b) =>
      new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );
  }

  async getPropertyById(id: number): Promise<Property | undefined> {
    return this.properties.get(id);
  }

  async getPropertyByExternalId(externalId: string): Promise<Property | undefined> {
    return Array.from(this.properties.values()).find(p => p.externalId === externalId);
  }

  async upsertProperty(data: InsertProperty): Promise<Property> {
    const existing = await this.getPropertyByExternalId(data.externalId);
    if (existing) {
      const updated: Property = {
        ...existing,
        ...data,
        id: existing.id,
        isNew: false,
        lastUpdatedAt: new Date(),
      };
      this.properties.set(existing.id, updated);
      return updated;
    }
    const newProp: Property = {
      ...data,
      id: this.propIdCounter++,
      isNew: true,
      hasPool: data.hasPool ?? false,
      hasGarden: data.hasGarden ?? false,
      hasGuesthouse: data.hasGuesthouse ?? false,
      seenAt: new Date(),
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
    };
    this.properties.set(newProp.id, newProp);
    return newProp;
  }

  async markAllAsSeen(): Promise<void> {
    for (const [id, prop] of this.properties) {
      this.properties.set(id, { ...prop, isNew: false });
    }
  }

  async deleteProperty(id: number): Promise<void> {
    this.properties.delete(id);
  }

  async createScrapeLog(data: InsertScrapeLog): Promise<ScrapeLog> {
    const log: ScrapeLog = {
      ...data,
      id: this.logIdCounter++,
      status: data.status ?? "running",
      newListings: data.newListings ?? 0,
      totalListings: data.totalListings ?? 0,
      startedAt: new Date(),
      finishedAt: null,
      errorMessage: data.errorMessage ?? null,
    };
    this.scrapeLogs.set(log.id, log);
    return log;
  }

  async updateScrapeLog(id: number, data: Partial<ScrapeLog>): Promise<ScrapeLog> {
    const existing = this.scrapeLogs.get(id);
    if (!existing) throw new Error(`ScrapeLog ${id} not found`);
    const updated = { ...existing, ...data };
    this.scrapeLogs.set(id, updated);
    return updated;
  }

  async getLatestScrapeLog(): Promise<ScrapeLog | undefined> {
    const logs = Array.from(this.scrapeLogs.values()).sort((a, b) =>
      new Date(b.startedAt!).getTime() - new Date(a.startedAt!).getTime()
    );
    return logs[0];
  }

  async getAllScrapeLogs(): Promise<ScrapeLog[]> {
    return Array.from(this.scrapeLogs.values()).sort((a, b) =>
      new Date(b.startedAt!).getTime() - new Date(a.startedAt!).getTime()
    );
  }
}

export const storage = new MemStorage();
