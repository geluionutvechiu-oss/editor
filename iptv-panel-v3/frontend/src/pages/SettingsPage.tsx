import { useQuery, useMutation } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { Save, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import api from '@/lib/api';

export default function SettingsPage() {
  const [smtpForm, setSmtpForm] = useState({ smtp_host: '', smtp_port: '587', smtp_user: '', smtp_pass: '', smtp_from: '' });
  const [brandingForm, setBrandingForm] = useState({ panel_name: 'IPTV Panel' });
  const [testEmail, setTestEmail] = useState('');
  const [testLoading, setTestLoading] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get('/settings').then(r => r.data),
  });

  useEffect(() => {
    if (settings) {
      if (settings.smtp_host) setSmtpForm({ smtp_host: settings.smtp_host, smtp_port: settings.smtp_port || '587', smtp_user: settings.smtp_user || '', smtp_pass: '', smtp_from: settings.smtp_from || '' });
      if (settings.panel_name) setBrandingForm({ panel_name: settings.panel_name });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: (data: Record<string, string>) => api.put('/settings', data),
    onSuccess: () => toast({ title: 'Settings saved' }),
    onError: () => toast({ title: 'Error saving settings', variant: 'destructive' }),
  });

  const saveSmtp = () => saveMutation.mutate(smtpForm);
  const saveBranding = () => saveMutation.mutate(brandingForm);

  const sendTestEmail = async () => {
    if (!testEmail) return;
    setTestLoading(true);
    try {
      await api.post('/settings/smtp/test', { to: testEmail });
      toast({ title: 'Test email sent', description: `Sent to ${testEmail}` });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to send';
      toast({ title: 'Failed to send email', description: msg, variant: 'destructive' });
    }
    setTestLoading(false);
  };

  const downloadBackup = () => window.open('/api/settings/backup', '_blank');

  const apiEndpoints = [
    { method: 'POST', path: '/api/auth/login', description: 'Login with email/password' },
    { method: 'GET', path: '/api/clients', description: 'List clients' },
    { method: 'POST', path: '/api/clients', description: 'Create client' },
    { method: 'GET', path: '/api/clients/:id/credentials', description: 'Get all credential formats' },
    { method: 'GET', path: '/api/plans', description: 'List plans' },
    { method: 'GET', path: '/api/servers', description: 'List servers' },
    { method: 'GET', path: '/api/dashboard/stats', description: 'Dashboard statistics' },
    { method: 'GET', path: '/get.php', description: 'M3U playlist (Xtream Codes compat)' },
    { method: 'GET', path: '/player_api.php', description: 'Xtream Codes API' },
    { method: 'GET', path: '/xmltv.php', description: 'XMLTV EPG feed' },
  ];

  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-bold">Settings</h2><p className="text-sm text-muted-foreground mt-1">Panel configuration</p></div>

      <Tabs defaultValue="smtp">
        <TabsList>
          <TabsTrigger value="smtp">SMTP</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="api-docs">API Docs</TabsTrigger>
          <TabsTrigger value="backup">Backup</TabsTrigger>
        </TabsList>

        <TabsContent value="smtp">
          <Card>
            <CardHeader><CardTitle>Email Configuration (SMTP)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? <Skeleton className="h-48" /> : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5"><Label>SMTP Host</Label><Input value={smtpForm.smtp_host} onChange={e => setSmtpForm(p => ({ ...p, smtp_host: e.target.value }))} placeholder="smtp.gmail.com" /></div>
                    <div className="space-y-1.5"><Label>Port</Label><Input value={smtpForm.smtp_port} onChange={e => setSmtpForm(p => ({ ...p, smtp_port: e.target.value }))} placeholder="587" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5"><Label>Username</Label><Input value={smtpForm.smtp_user} onChange={e => setSmtpForm(p => ({ ...p, smtp_user: e.target.value }))} /></div>
                    <div className="space-y-1.5"><Label>Password</Label><Input type="password" value={smtpForm.smtp_pass} onChange={e => setSmtpForm(p => ({ ...p, smtp_pass: e.target.value }))} placeholder="Leave blank to keep current" /></div>
                  </div>
                  <div className="space-y-1.5"><Label>From Address</Label><Input value={smtpForm.smtp_from} onChange={e => setSmtpForm(p => ({ ...p, smtp_from: e.target.value }))} placeholder="noreply@iptv-panel.com" /></div>
                  <Button variant="gradient" onClick={saveSmtp} loading={saveMutation.isPending}><Save className="h-4 w-4 mr-2" />Save SMTP</Button>

                  <div className="border-t border-border pt-4">
                    <Label>Send Test Email</Label>
                    <div className="flex gap-2 mt-1.5">
                      <Input value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="test@example.com" type="email" />
                      <Button variant="outline" onClick={sendTestEmail} loading={testLoading}><Send className="h-4 w-4 mr-2" />Send</Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branding">
          <Card>
            <CardHeader><CardTitle>Branding</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5"><Label>Panel Name</Label><Input value={brandingForm.panel_name} onChange={e => setBrandingForm(p => ({ ...p, panel_name: e.target.value }))} /></div>
              <Button variant="gradient" onClick={saveBranding} loading={saveMutation.isPending}><Save className="h-4 w-4 mr-2" />Save</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api-docs">
          <Card>
            <CardHeader><CardTitle>API Reference</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {apiEndpoints.map(ep => (
                  <div key={ep.path + ep.method} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-slate-800/30 hover:bg-slate-800/50 transition-colors">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${ep.method === 'GET' ? 'bg-green-500/20 text-green-400' : ep.method === 'POST' ? 'bg-blue-500/20 text-blue-400' : ep.method === 'PUT' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>{ep.method}</span>
                    <code className="text-sm font-mono text-blue-300 flex-1">{ep.path}</code>
                    <span className="text-sm text-muted-foreground hidden sm:block">{ep.description}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-4">All endpoints require <code className="text-blue-400">Authorization: Bearer &lt;token&gt;</code> header except login.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backup">
          <Card>
            <CardHeader><CardTitle>Database Backup</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Export your entire database as a JSON file. This includes all clients, plans, servers, invoices, and settings.</p>
              <Button variant="gradient" onClick={downloadBackup}>Download Backup</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
