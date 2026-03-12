import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import PerplexityAttribution from "@/components/PerplexityAttribution";
import { useTheme } from "@/components/ThemeProvider";
import type { Property } from "@shared/schema";

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 12H5M12 19l-7-7 7-7"/>
    </svg>
  );
}
function LinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <polyline points="15 3 21 3 21 9"/>
      <line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  );
}
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

function formatPrice(price: number | null | undefined): string {
  if (!price) return "Cena na dotaz";
  return `€ ${price.toLocaleString("cs-CZ")}`;
}

function FeatureItem({ icon, label, value }: { icon: string; label: string; value?: string | number | boolean | null }) {
  if (value == null || value === false) return null;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-lg">{icon}</span>
      <span className="text-foreground font-medium">{label}</span>
      {typeof value !== "boolean" && (
        <span className="text-muted-foreground">{value}</span>
      )}
    </div>
  );
}

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const { theme, toggleTheme } = useTheme();
  const [imgIdx, setImgIdx] = useState(0);

  const { data: property, isLoading } = useQuery<Property>({
    queryKey: ["/api/properties", id],
    queryFn: async () => {
      const res = await fetch(`/api/properties/${id}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
  });

  const imgs = property?.images ? JSON.parse(property.images) : [];
  if (property?.imageUrl && !imgs.includes(property.imageUrl)) imgs.unshift(property.imageUrl);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-sm border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/">
            <button className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
              <BackIcon />
              Zpět na seznam
            </button>
          </Link>
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-72 w-full rounded-xl" />
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : !property ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground">Nemovitost nenalezena.</p>
            <Link href="/">
              <Button className="mt-4" variant="outline">Zpět na seznam</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Images */}
            <div className="space-y-3">
              {imgs.length > 0 ? (
                <>
                  <div className="relative h-72 sm:h-96 rounded-xl overflow-hidden bg-muted">
                    <img
                      src={imgs[imgIdx]}
                      alt={property.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                    {property.isNew && (
                      <span className="absolute top-3 left-3 badge-new">Nový inzerát</span>
                    )}
                  </div>
                  {imgs.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {imgs.map((img: string, i: number) => (
                        <button
                          key={i}
                          onClick={() => setImgIdx(i)}
                          className={`flex-shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 transition-colors ${
                            i === imgIdx ? "border-primary" : "border-transparent"
                          }`}
                        >
                          <img src={img} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="property-img-placeholder h-72 rounded-xl flex items-center justify-center">
                  <span className="text-muted-foreground">Bez fotky</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Main info */}
              <div className="lg:col-span-2 space-y-6">
                {/* Header */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      property.region.toLowerCase().includes("tosc")
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                        : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                    }`}>
                      {property.region.toLowerCase().includes("tosc") ? "🌻 Toskánsko" : "🏔 Tyrolsko"}
                    </span>
                    {property.condition && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{property.condition}</span>
                    )}
                  </div>
                  <h1 className="text-xl font-bold text-foreground font-serif leading-snug">
                    {property.title}
                  </h1>
                  <p className="text-muted-foreground text-sm mt-1">
                    📍 {[property.address, property.municipality, property.province].filter(Boolean).join(", ") || property.region}
                  </p>
                </div>

                <Separator />

                {/* Description */}
                {property.description && (
                  <div>
                    <h2 className="text-base font-semibold text-foreground mb-2 font-serif">Popis</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {property.description}
                    </p>
                  </div>
                )}

                {/* Features grid */}
                <div>
                  <h2 className="text-base font-semibold text-foreground mb-3 font-serif">Vlastnosti</h2>
                  <div className="grid grid-cols-2 gap-3">
                    <FeatureItem icon="🏠" label="Plocha" value={property.livingAreaM2 ? `${property.livingAreaM2} m²` : null} />
                    <FeatureItem icon="🌿" label="Pozemek" value={property.landSizeM2 ? `${property.landSizeM2?.toLocaleString()} m²` : null} />
                    <FeatureItem icon="🚪" label="Pokoje" value={property.rooms} />
                    <FeatureItem icon="🛏" label="Ložnice" value={property.bedrooms} />
                    <FeatureItem icon="🚿" label="Koupelny" value={property.bathrooms} />
                    <FeatureItem icon="🏊" label="Bazén" value={property.hasPool || null} />
                    <FeatureItem icon="🌳" label="Zahrada" value={property.hasGarden || null} />
                    <FeatureItem icon="🏡" label="Domek pro hosty" value={property.hasGuesthouse || null} />
                  </div>
                </div>
              </div>

              {/* Sidebar */}
              <div className="space-y-4">
                <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Cena</p>
                    <p className="text-2xl font-bold text-primary font-serif mt-0.5">
                      {formatPrice(property.price)}
                    </p>
                    {property.priceText && property.priceText !== formatPrice(property.price) && (
                      <p className="text-sm text-muted-foreground">{property.priceText}</p>
                    )}
                  </div>

                  <Separator />

                  <a
                    href={property.listingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full"
                  >
                    <Button className="w-full gap-2" data-testid="button-view-listing">
                      <LinkIcon />
                      Zobrazit na immobiliare.it
                    </Button>
                  </a>

                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>ID: <span className="font-mono">{property.externalId}</span></p>
                    {property.createdAt && (
                      <p>Přidáno: {new Date(property.createdAt).toLocaleDateString("cs-CZ")}</p>
                    )}
                  </div>
                </div>

                {/* Map placeholder */}
                {property.latitude && property.longitude && (
                  <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${property.latitude}&mlon=${property.longitude}&zoom=12`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <img
                        src={`https://maps.geoapify.com/v1/staticmap?style=osm-bright-smooth&width=400&height=200&center=lonlat:${property.longitude},${property.latitude}&zoom=11&marker=lonlat:${property.longitude},${property.latitude};color:%23e07038;size:medium&apiKey=your_key`}
                        alt="Mapa"
                        className="w-full h-40 object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).parentElement!.innerHTML = `
                            <a href="https://www.openstreetmap.org/?mlat=${property.latitude}&mlon=${property.longitude}&zoom=12" target="_blank" rel="noopener noreferrer"
                               class="flex items-center justify-center h-40 bg-muted text-muted-foreground text-sm hover:bg-muted/80 transition-colors">
                              📍 Otevřít v mapě
                            </a>`;
                        }}
                      />
                    </a>
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      {property.latitude.toFixed(4)}, {property.longitude.toFixed(4)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-border mt-12 py-6">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Zdroj: <a href="https://www.immobiliare.it" target="_blank" rel="noopener noreferrer" className="hover:underline">immobiliare.it</a>
          </p>
          <PerplexityAttribution />
        </div>
      </footer>
    </div>
  );
}
