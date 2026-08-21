import { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Globe } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchSeverityLocationHeatmap } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

const severityColors: Record<string, string> = {
  "0: Low/Normal": "#22c55e",
  "1: Medium": "#eab308",
  "2: Severe": "#ef4444",
};

const severities = ["0: Low/Normal", "1: Medium", "2: Severe"];

export default function HeatmapChart() {
  const { data, isLoading } = useQuery({
    queryKey: ["severity-location-heatmap"],
    queryFn: fetchSeverityLocationHeatmap,
  });

  const heatmap = data?.heatmap ?? [];

  // All derived state computed via useMemo — no hooks after early return
  const { locations, cells, colCount } = useMemo(() => {
    const locs = [...new Set(heatmap.map((h) => h.location))].slice(0, 15);

    const lookup = new Map<string, number>();
    let maxVol = 0;
    for (const item of heatmap) {
      const key = `${item.location}|${item.severity_label}`;
      lookup.set(key, item.volume);
      if (item.volume > maxVol) maxVol = item.volume;
    }

    const cellData: { location: string; severity: string; volume: number; opacity: number }[] = [];
    for (const loc of locs) {
      for (const sev of severities) {
        const vol = lookup.get(`${loc}|${sev}`) ?? 0;
        cellData.push({
          location: loc,
          severity: sev,
          volume: vol,
          opacity: maxVol > 0 ? 0.15 + (vol / maxVol) * 0.85 : 0,
        });
      }
    }

    return { locations: locs, cells: cellData, colCount: severities.length };
  }, [heatmap]);

  if (isLoading) return <Skeleton className="h-80 rounded-xl" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe className="h-4 w-4 text-noc-accent" />
          Ticket Volume & Severity by Location
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div
            className="inline-grid min-w-full"
            style={{
              gridTemplateColumns: `120px repeat(${colCount}, 1fr)`,
              gap: "2px",
            }}
          >
            {/* Header row */}
            <div className="p-2 text-[10px] font-medium uppercase text-noc-text-dim" />
            {severities.map((sev) => (
              <div
                key={sev}
                className="p-2 text-center text-[10px] font-medium uppercase text-noc-text-dim"
              >
                {sev.split(": ")[1]}
              </div>
            ))}

            {/* Data rows */}
            {locations.map((loc) => (
              <div key={loc} className="contents">
                <div
                  className="flex items-center truncate p-2 text-xs text-noc-text-muted"
                  title={loc}
                >
                  {loc}
                </div>
                {severities.map((sev) => {
                  const cell = cells.find(
                    (c) => c.location === loc && c.severity === sev,
                  );
                  const color = severityColors[sev] ?? "#38bdf8";
                  return (
                    <div
                      key={`${loc}-${sev}`}
                      className="flex items-center justify-center rounded p-2 text-xs font-bold font-[family-name:var(--font-mono)] transition hover:ring-1 hover:ring-white/20"
                      style={{
                        backgroundColor: color,
                        opacity: cell?.opacity ?? 0,
                      }}
                      title={`${loc} — ${sev}: ${cell?.volume ?? 0}`}
                    >
                      {cell?.volume ?? 0}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
