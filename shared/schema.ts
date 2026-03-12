import { pgTable, text, integer, boolean, real, timestamp, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const properties = pgTable("properties", {
  id: serial("id").primaryKey(),
  externalId: text("external_id").notNull().unique(),
  title: text("title").notNull(),
  price: integer("price"),
  priceText: text("price_text"),
  region: text("region").notNull(), // "Toscana" | "Alto Adige/Tiroler"
  province: text("province"),
  municipality: text("municipality"),
  address: text("address"),
  propertyType: text("property_type"), // house, villa, farmhouse, etc.
  hasPool: boolean("has_pool").default(false),
  hasGarden: boolean("has_garden").default(false),
  hasGuesthouse: boolean("has_guesthouse").default(false),
  landSizeM2: integer("land_size_m2"),
  livingAreaM2: integer("living_area_m2"),
  rooms: integer("rooms"),
  bedrooms: integer("bedrooms"),
  bathrooms: integer("bathrooms"),
  condition: text("condition"),
  imageUrl: text("image_url"),
  images: text("images"), // JSON string of image URLs
  listingUrl: text("listing_url").notNull(),
  description: text("description"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  isNew: boolean("is_new").default(true),
  seenAt: timestamp("seen_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  lastUpdatedAt: timestamp("last_updated_at").defaultNow(),
});

export const scrapeLog = pgTable("scrape_log", {
  id: serial("id").primaryKey(),
  startedAt: timestamp("started_at").defaultNow(),
  finishedAt: timestamp("finished_at"),
  status: text("status").notNull().default("running"), // running | success | error
  newListings: integer("new_listings").default(0),
  totalListings: integer("total_listings").default(0),
  errorMessage: text("error_message"),
});

export const insertPropertySchema = createInsertSchema(properties).omit({ id: true, createdAt: true, lastUpdatedAt: true });
export const insertScrapeLogSchema = createInsertSchema(scrapeLog).omit({ id: true });

export type InsertProperty = z.infer<typeof insertPropertySchema>;
export type Property = typeof properties.$inferSelect;
export type ScrapeLog = typeof scrapeLog.$inferSelect;
export type InsertScrapeLog = z.infer<typeof insertScrapeLogSchema>;
