import { useQuery } from '@tanstack/react-query';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import api from '@/lib/api';
import type { Client, CredentialFormats } from '@/types';

interface Props { client: Client; open: boolean; onClose: () => void; }

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</div>
      <div className="flex gap-2">
        <div className="flex-1 px-3 py-2 rounded-lg bg-slate-800/60 border border-border text-sm font-mono text-foreground/90 break-all">{value}</div>
        <button onClick={copy} className="h-9 w-9 rounded-lg border border-border bg-slate-800/60 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
          {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

const appTabs = [
  { key: 'm3u', label: 'M3U' },
  { key: 'xtream', label: 'Xtream' },
  { key: 'tivimate', label: 'TiviMate' },
  { key: 'smartersPro', label: 'Smarters' },
  { key: 'gse', label: 'GSE' },
  { key: 'duplexPlay', label: 'Duplex' },
  { key: 'kodi', label: 'Kodi' },
  { key: 'vlc', label: 'VLC' },
  { key: 'ottNavigator', label: 'OTT' },
  { key: 'perfectPlayer', label: 'Perfect' },
  { key: 'lazyIptv', label: 'Lazy IPTV' },
];

export function CredentialsModal({ client, open, onClose }: Props) {
  const { data: creds, isLoading } = useQuery<CredentialFormats>({
    queryKey: ['credentials', client.id],
    queryFn: () => api.get(`/clients/${client.id}/credentials`).then(r => r.data),
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Connection Info — {client.username}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : creds ? (
          <Tabs defaultValue="m3u">
            <div className="overflow-x-auto">
              <TabsList className="h-auto flex-wrap gap-1 w-max min-w-full">
                {appTabs.map(t => <TabsTrigger key={t.key} value={t.key} className="text-xs">{t.label}</TabsTrigger>)}
              </TabsList>
            </div>

            <TabsContent value="m3u" className="space-y-3">
              <CopyField label="M3U URL" value={creds.m3u.url} />
              <div className="flex gap-4 items-start">
                <div className="flex-1 p-3 rounded-lg bg-slate-800/40 border border-border text-xs text-muted-foreground whitespace-pre-line">{creds.m3u.instructions}</div>
                {creds.m3u.qr && <img src={creds.m3u.qr} alt="QR" className="h-24 w-24 rounded-lg" />}
              </div>
            </TabsContent>

            <TabsContent value="xtream" className="space-y-3">
              <CopyField label="Host / Server URL" value={creds.xtream.host} />
              <CopyField label="Username" value={creds.xtream.username} />
              <CopyField label="Password" value={creds.xtream.password} />
              <div className="flex gap-4 items-start">
                <div className="flex-1 p-3 rounded-lg bg-slate-800/40 border border-border text-xs text-muted-foreground whitespace-pre-line">{creds.xtream.instructions}</div>
                {creds.xtream.qr && <img src={creds.xtream.qr} alt="QR" className="h-24 w-24 rounded-lg" />}
              </div>
            </TabsContent>

            <TabsContent value="tivimate" className="space-y-3">
              <CopyField label="M3U URL" value={creds.tivimate.m3uUrl} />
              <CopyField label="EPG URL" value={creds.tivimate.epgUrl} />
              <div className="flex gap-4 items-start">
                <div className="flex-1 p-3 rounded-lg bg-slate-800/40 border border-border text-xs text-muted-foreground whitespace-pre-line">{creds.tivimate.instructions}</div>
                {creds.tivimate.qr && <img src={creds.tivimate.qr} alt="QR" className="h-24 w-24 rounded-lg" />}
              </div>
            </TabsContent>

            {(['smartersPro', 'duplexPlay', 'ottNavigator'] as const).map(key => {
              const c = creds[key] as { label: string; host: string; username: string; password: string; instructions: string; qr: string };
              return (
                <TabsContent key={key} value={key} className="space-y-3">
                  <CopyField label="Host" value={c.host} />
                  <CopyField label="Username" value={c.username} />
                  <CopyField label="Password" value={c.password} />
                  <div className="flex gap-4 items-start">
                    <div className="flex-1 p-3 rounded-lg bg-slate-800/40 border border-border text-xs text-muted-foreground whitespace-pre-line">{c.instructions}</div>
                    {c.qr && <img src={c.qr} alt="QR" className="h-24 w-24 rounded-lg" />}
                  </div>
                </TabsContent>
              );
            })}

            {(['gse', 'vlc', 'perfectPlayer', 'lazyIptv'] as const).map(key => {
              const c = creds[key] as { label: string; m3uUrl: string; instructions: string; qr: string };
              return (
                <TabsContent key={key} value={key} className="space-y-3">
                  <CopyField label="M3U URL" value={c.m3uUrl} />
                  <div className="flex gap-4 items-start">
                    <div className="flex-1 p-3 rounded-lg bg-slate-800/40 border border-border text-xs text-muted-foreground whitespace-pre-line">{c.instructions}</div>
                    {c.qr && <img src={c.qr} alt="QR" className="h-24 w-24 rounded-lg" />}
                  </div>
                </TabsContent>
              );
            })}

            <TabsContent value="kodi" className="space-y-3">
              <CopyField label="M3U URL" value={creds.kodi.m3uUrl} />
              <CopyField label="EPG URL" value={creds.kodi.epgUrl} />
              <div className="p-3 rounded-lg bg-slate-800/40 border border-border text-xs text-muted-foreground whitespace-pre-line">{creds.kodi.instructions}</div>
            </TabsContent>
          </Tabs>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
