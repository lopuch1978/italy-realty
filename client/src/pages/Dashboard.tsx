import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import PerplexityAttribution from "@/components/PerplexityAttribution";
import type { Property } from "@shared/schema";

// Icons
function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="5"/>
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}
function RefreshIcon({ spin }: { spin?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      style={{ animation: spin ? "spin 1s linear infinite" : "none" }}
      className={spin ? "animate-spin" : ""}>
      <polyline points="23 4 23 10 17 10"/>
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    </svg>
  );
}
function HomeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9,22 9,12 15,12 15,22"/>
    </svg>
  );
}
function PoolIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 12h20M6 18c0-2 4-2 4 0s4 2 4 0 4 2 4 0"/>
      <path d="M6 12V8a6 6 0 0 1 12 0v4"/>
    </svg>
  );
}
function GardenIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="7" r="5"/>
      <path d="M12 12v10M8 22h8"/>
    </svg>
  );
}
function GuestIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <rect x="9" y="14" width="6" height="8"/>
    </svg>
  );
}
function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  );
}
function MapPinIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  );
}

// Logo SVG
function Logo() {
  return (
    <svg aria-label="Italia Domy" viewBox="0 0 140 32" fill="none" className="h-8 w-auto" xmlns="http://www.w3.org/2000/svg">
      {/* House outline */}
      <path d="M8 28V16L16 8l8 8v12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="11" y="20" width="5" height="8" rx="0.5" stroke="currentColor" strokeWidth="1.5"/>
      {/* Roof accent */}
      <path d="M16 8l2 2" stroke="hsl(25,60%,48%)" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Text */}
      <text x="30" y="22" fontFamily="Zodiak, Lora, Georgia, serif" fontSize="15" fontWeight="600" fill="currentColor">Italia</text>
      <text x="82" y="22" fontFamily="Satoshi, Inter, sans-serif" fontSize="13" fontWeight="400" fill="currentColor" opacity="0.6">Domy</text>
    </svg>
  );
}

function formatPrice(price: number | null | undefined): string {
  if (!price) return "Cena na dotaz";
  return `€ ${price.toLocaleString("cs-CZ")}`;
}

function PropertyCard({ property }: { property: Property }) {
  const imgs = property.images ? JSON.parse(property.images) : [];
  const mainImg = property.imageUrl || imgs[0];

  return (
    <Link href={`/property/${property.id}`}>
      <article
        data-testid={`card-property-${property.id}`}
        className="property-card bg-card border border-border rounded-xl overflow-hidden cursor-pointer group"
      >
        {/* Image */}
        <div className="relative h-48 overflow-hidden bg-muted">
          {mainImg ? (
            <img
              src={mainImg}
              alt={property.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="property-img-placeholder w-full h-full flex items-center justify-center">
              <span className="text-muted-foreground text-sm">Bez fotky</span>
            </div>
          )}
          {/* Badges top-left */}
          <div className="absolute top-2 left-2 flex gap-1">
            {property.isNew && (
              <span className="badge-new">Nový</span>
            )}
          </div>
          {/* Pool badge top-right */}
          {property.hasPool && (
            <div className="absolute top-2 right-2">
              <span className="badge-pool inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full">
                <PoolIcon /> Bazén
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Price */}
          <div className="flex items-start justify-between gap-2">
            <p className="text-xl font-bold text-primary font-serif">
              {formatPrice(property.price)}
            </p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              property.region.toLowerCase().includes("tosc")
                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
            }`}>
              {property.region.toLowerCase().includes("tosc") ? "🌻 Toskánsko" : "🏔 Tyrolsko"}
            </span>
          </div>

          {/* Title */}
          <h3 className="font-semibold text-sm leading-snug text-foreground line-clamp-2">
            {property.title}
          </h3>

          {/* Location */}
          <div className="flex items-center gap-1 text-muted-foreground text-xs">
            <MapPinIcon />
            <span>{[property.municipality, property.province].filter(Boolean).join(", ") || property.region}</span>
          </div>

          {/* Features */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {property.hasGarden && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                <GardenIcon /> Zahrada
              </span>
            )}
            {property.hasGuesthouse && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                <GuestIcon /> Domek pro hosty
              </span>
            )}
            {property.livingAreaM2 && (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {property.livingAreaM2} m²
              </span>
            )}
            {property.rooms && (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {property.rooms} pokojů
              </span>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}

function PropertyCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <Skeleton className="h-48 w-full skeleton-shimmer" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-6 w-32 skeleton-shimmer" />
        <Skeleton className="h-4 w-full skeleton-shimmer" />
        <Skeleton className="h-4 w-3/4 skeleton-shimmer" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16 rounded-full skeleton-shimmer" />
          <Skeleton className="h-5 w-20 rounded-full skeleton-shimmer" />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();

  // Filters
  const [region, setRegion] = useState<string>("all");
  const [hasPool, setHasPool] = useState(false);
  const [hasGuesthouse, setHasGuesthouse] = useState(false);
  const [onlyNew, setOnlyNew] = useState(false);
  const [sortBy, setSortBy] = useState<string>("newest");

  const { data: stats } = useQuery<{
    total: number;
    newCount: number;
    withPool: number;
    withGuesthouse: number;
    toscana: number;
    tirolo: number;
    lastScrape: string | null;
    lastScrapeStatus: string | null;
  }>({ queryKey: ["/api/stats"] });

  const { data: properties, isLoading } = useQuery<Property[]>({
    queryKey: ["/api/properties", region, hasPool, hasGuesthouse, onlyNew],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (region !== "all") params.set("region", region);
      if (hasPool) params.set("hasPool", "true");
      if (hasGuesthouse) params.set("hasGuesthouse", "true");
      if (onlyNew) params.set("onlyNew", "true");
      const res = await fetch(`/api/properties?${params}`);
      return res.json();
    },
  });

  const scrapeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/scrape");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Aktualizace spuštěna", description: "Nové inzeráty se načítají z immobiliare.it..." });
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
        queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      }, 8000);
    },
    onError: () => {
      toast({ title: "Chyba", description: "Aktualizaci se nepodařilo spustit.", variant: "destructive" });
    },
  });

  const markSeenMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/properties/mark-seen");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Označeno jako přečtené" });
    },
  });

  const sorted = useMemo(() => {
    if (!properties) return [];
    const arr = [...properties];
    if (sortBy === "price-asc") arr.sort((a, b) => (a.price ?? 999999) - (b.price ?? 999999));
    if (sortBy === "price-desc") arr.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
    if (sortBy === "newest") arr.sort((a, b) =>
      new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
    );
    return arr;
  }, [properties, sortBy]);

  const lastScrapeText = stats?.lastScrape
    ? new Date(stats.lastScrape).toLocaleDateString("cs-CZ", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "Zatím neproběhlo";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/">
            <span className="flex items-center gap-2 text-foreground hover:text-primary transition-colors cursor-pointer">
              <Logo />
            </span>
          </Link>
          <div className="flex items-center gap-3">
            {stats?.newCount != null && stats.newCount > 0 && (
              <button
                data-testid="button-mark-seen"
                onClick={() => markSeenMutation.mutate()}
                className="flex items-center gap-1.5 text-xs text-primary font-medium hover:underline"
              >
                <BellIcon />
                <span>{stats.newCount} nových</span>
              </button>
            )}
            <Button
              data-testid="button-refresh"
              variant="outline"
              size="sm"
              onClick={() => scrapeMutation.mutate()}
              disabled={scrapeMutation.isPending}
              className="gap-1.5 text-xs"
            >
              <RefreshIcon spin={scrapeMutation.isPending} />
              {scrapeMutation.isPending ? "Načítám..." : "Aktualizovat"}
            </Button>
            <button
              data-testid="button-theme-toggle"
              onClick={toggleTheme}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Přepnout tmavý/světlý režim"
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
        </div>
      </header>

      {/* Hero / stats bar */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-foreground font-serif">
                Nemovitosti v Itálii
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Toskánsko & Tyrolsko · 80 000 – 150 000 € · Domy s pozemkem
              </p>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary font-serif">{stats?.total ?? "—"}</div>
                <div className="text-xs text-muted-foreground">celkem</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 font-serif">{stats?.toscana ?? "—"}</div>
                <div className="text-xs text-muted-foreground">Toskánsko</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 font-serif">{stats?.tirolo ?? "—"}</div>
                <div className="text-xs text-muted-foreground">Tyrolsko</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400 font-serif">{stats?.withPool ?? "—"}</div>
                <div className="text-xs text-muted-foreground">s bazénem</div>
              </div>
              {stats?.newCount != null && stats.newCount > 0 && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400 font-serif">{stats.newCount}</div>
                  <div className="text-xs text-muted-foreground">nové</div>
                </div>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Poslední aktualizace: {lastScrapeText}
            {stats?.lastScrapeStatus && (
              <span className={`ml-1.5 ${stats.lastScrapeStatus === "success" ? "text-green-600" : stats.lastScrapeStatus === "error" ? "text-destructive" : "text-amber-600"}`}>
                ({stats.lastScrapeStatus === "success" ? "úspěšná" : stats.lastScrapeStatus === "error" ? "chyba" : "probíhá"})
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Filters */}
        <div className="bg-card border border-border rounded-xl p-4 mb-6">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            {/* Region */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-foreground whitespace-nowrap">Oblast:</label>
              <Select value={region} onValueChange={setRegion}>
                <SelectTrigger data-testid="select-region" className="w-36 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Vše</SelectItem>
                  <SelectItem value="toscana">🌻 Toskánsko</SelectItem>
                  <SelectItem value="tirolo">🏔 Tyrolsko</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator orientation="vertical" className="h-6 hidden sm:block" />

            {/* Pool toggle */}
            <div className="flex items-center gap-2">
              <Switch
                id="filter-pool"
                data-testid="switch-pool"
                checked={hasPool}
                onCheckedChange={setHasPool}
              />
              <Label htmlFor="filter-pool" className="text-sm cursor-pointer flex items-center gap-1">
                <PoolIcon /> Bazén
              </Label>
            </div>

            {/* Guesthouse toggle */}
            <div className="flex items-center gap-2">
              <Switch
                id="filter-guesthouse"
                data-testid="switch-guesthouse"
                checked={hasGuesthouse}
                onCheckedChange={setHasGuesthouse}
              />
              <Label htmlFor="filter-guesthouse" className="text-sm cursor-pointer flex items-center gap-1">
                <GuestIcon /> Domek pro hosty
              </Label>
            </div>

            {/* Only new toggle */}
            <div className="flex items-center gap-2">
              <Switch
                id="filter-new"
                data-testid="switch-new"
                checked={onlyNew}
                onCheckedChange={setOnlyNew}
              />
              <Label htmlFor="filter-new" className="text-sm cursor-pointer">
                Jen nové
              </Label>
            </div>

            <Separator orientation="vertical" className="h-6 hidden sm:block" />

            {/* Sort */}
            <div className="flex items-center gap-2 ml-auto">
              <label className="text-sm font-medium text-foreground whitespace-nowrap">Řazení:</label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger data-testid="select-sort" className="w-36 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Nejnovější</SelectItem>
                  <SelectItem value="price-asc">Cena: nejlevnější</SelectItem>
                  <SelectItem value="price-desc">Cena: nejdražší</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <PropertyCardSkeleton key={i} />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-20">
            <HomeIcon />
            <p className="mt-4 text-muted-foreground font-serif text-lg">Žádné nemovitosti nenalezeny</p>
            <p className="text-sm text-muted-foreground mt-1">Zkuste změnit filtry nebo spustit aktualizaci.</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => scrapeMutation.mutate()}
              disabled={scrapeMutation.isPending}
            >
              <RefreshIcon spin={scrapeMutation.isPending} />
              <span className="ml-2">Aktualizovat nyní</span>
            </Button>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              Nalezeno {sorted.length} {sorted.length === 1 ? "nemovitost" : sorted.length < 5 ? "nemovitosti" : "nemovitostí"}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {sorted.map(p => (
                <PropertyCard key={p.id} property={p} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-border mt-12 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Zdroj dat: <a href="https://www.immobiliare.it" target="_blank" rel="noopener noreferrer" className="hover:underline">immobiliare.it</a>
          </p>
          <PerplexityAttribution />
        </div>
      </footer>
    </div>
  );
}
