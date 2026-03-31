import geoip from 'geoip-lite';

export interface GeoInfo {
  ip: string;
  country: string;
  countryCode: string;
  city: string;
  region: string;
  ll: [number, number]; // [lat, lon]
  isp: string;
  asn: string;
}

export function lookupIp(ip: string): GeoInfo | null {
  const geo = geoip.lookup(ip);
  if (!geo) return null;
  return {
    ip,
    country: geo.country || '',
    countryCode: geo.country || '',
    city: geo.city || '',
    region: geo.region || '',
    ll: geo.ll || [0, 0],
    isp: (geo as any).org || '',
    asn: (geo as any).asn || '',
  };
}

export function lookupBatch(ips: string[]): GeoInfo[] {
  return ips.map(ip => lookupIp(ip)).filter(Boolean) as GeoInfo[];
}
