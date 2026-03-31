import { useQuery } from '@tanstack/react-query';
import { Globe, Users, MapPin, Wifi } from 'lucide-react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import api from '@/lib/api';

interface LiveConnection {
  ip: string;
  lat: number;
  lon: number;
  country: string;
  username: string;
  streamName: string;
}

interface LiveMapData {
  connections: LiveConnection[];
}

function countryToFlag(code: string): string {
  if (!code || code.length !== 2) return '🌐';
  return code.toUpperCase().replace(/./g, char =>
    String.fromCodePoint(char.charCodeAt(0) + 127397)
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ElementType; color: string }) {
  return (
    <Card className="glass-card animate-fade-in">
      <CardContent className="p-5">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-xl ${color} flex items-center justify-center flex-shrink-0`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function UserMapPage() {
  const { data, isLoading } = useQuery<LiveMapData>({
    queryKey: ['live-map'],
    queryFn: () => api.get('/security/live-map').then(r => r.data),
    refetchInterval: 10000,
  });

  const connections = data?.connections ?? [];

  // Stats
  const totalConnections = connections.length;
  const uniqueCountries = new Set(connections.map(c => c.country).filter(Boolean)).size;
  const countryCounts = connections.reduce<Record<string, number>>((acc, c) => {
    if (c.country) acc[c.country] = (acc[c.country] || 0) + 1;
    return acc;
  }, {});
  const topCountryEntry = Object.entries(countryCounts).sort((a, b) => b[1] - a[1])[0];
  const topCountry = topCountryEntry ? `${countryToFlag(topCountryEntry[0])} ${topCountryEntry[0]} (${topCountryEntry[1]})` : '—';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
          <Globe className="h-5 w-5 text-blue-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Live User Map</h2>
          <p className="text-sm text-muted-foreground">Active connections updated every 10 seconds</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-green-400">Live</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Active" value={isLoading ? '...' : totalConnections} icon={Wifi} color="bg-blue-500/10 border border-blue-500/20 text-blue-400" />
        <StatCard label="Countries" value={isLoading ? '...' : uniqueCountries} icon={MapPin} color="bg-purple-500/10 border border-purple-500/20 text-purple-400" />
        <StatCard label="Top Country" value={isLoading ? '...' : topCountry} icon={Globe} color="bg-green-500/10 border border-green-500/20 text-green-400" />
      </div>

      {/* Country distribution */}
      {!isLoading && Object.keys(countryCounts).length > 0 && (
        <Card className="glass-card animate-fade-in">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Country Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(countryCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([country, count]) => (
                  <Badge key={country} variant="secondary" className="gap-1 text-sm">
                    {countryToFlag(country)} {country}
                    <span className="ml-1 text-xs text-muted-foreground">({count})</span>
                  </Badge>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Connections table */}
      <Card className="glass-card animate-fade-in">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Users className="h-4 w-4" />
            Active Connections
          </CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {['Flag', 'IP Address', 'Username', 'Stream', 'Country', 'Coordinates'].map(h => (
                  <th key={h} className="p-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="p-4"><Skeleton className="h-4" /></td>
                    ))}
                  </tr>
                ))
              ) : connections.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-muted-foreground">
                    <Globe className="h-8 w-8 mx-auto mb-3 opacity-30" />
                    <p>No active connections</p>
                  </td>
                </tr>
              ) : (
                connections.map((conn, i) => (
                  <tr key={`${conn.ip}-${i}`} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors">
                    <td className="p-4 text-2xl">{countryToFlag(conn.country)}</td>
                    <td className="p-4 font-mono text-sm text-blue-300">{conn.ip}</td>
                    <td className="p-4 font-medium text-sm">{conn.username || '—'}</td>
                    <td className="p-4 text-sm text-muted-foreground truncate max-w-[200px]">{conn.streamName || '—'}</td>
                    <td className="p-4 text-sm">{conn.country || '—'}</td>
                    <td className="p-4 text-xs font-mono text-muted-foreground">
                      {conn.lat !== 0 || conn.lon !== 0 ? `${conn.lat.toFixed(2)}, ${conn.lon.toFixed(2)}` : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
