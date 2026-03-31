import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Folder, Edit2, Trash2, List, Film, Tv, Radio } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import api from '@/lib/api';

interface Category {
  id: string;
  name: string;
  type: 'LIVE' | 'MOVIE' | 'SERIES' | 'RADIO';
  sortOrder: number;
  isActive: boolean;
  itemCount: number;
}

const TABS: { label: string; type: Category['type']; icon: React.ComponentType<any>; color: string }[] = [
  { label: 'Live TV', type: 'LIVE', icon: List, color: 'text-blue-400' },
  { label: 'Movies', type: 'MOVIE', icon: Film, color: 'text-purple-400' },
  { label: 'Series', type: 'SERIES', icon: Tv, color: 'text-pink-400' },
  { label: 'Radio', type: 'RADIO', icon: Radio, color: 'text-green-400' },
];

export default function CategoriesPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<Category['type']>('LIVE');
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: '', sortOrder: '0', isActive: true });

  const { data, isLoading } = useQuery<{ data: Category[]; total: number }>({
    queryKey: ['categories', activeTab],
    queryFn: () => api.get(`/categories?type=${activeTab}&limit=100`).then(r => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: (d: any) => editItem ? api.put(`/categories/${editItem.id}`, d) : api.post('/categories', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); setModalOpen(false); toast({ title: editItem ? 'Category updated' : 'Category created' }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/categories/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); toast({ title: 'Category deleted' }); },
  });

  function openAdd() { setEditItem(null); setForm({ name: '', sortOrder: '0', isActive: true }); setModalOpen(true); }
  function openEdit(c: Category) { setEditItem(c); setForm({ name: c.name, sortOrder: String(c.sortOrder), isActive: c.isActive }); setModalOpen(true); }

  const activeTabDef = TABS.find(t => t.type === activeTab)!;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Categories</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Organize content into categories for easy browsing</p>
        </div>
        <Button onClick={openAdd} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 border-0">
          <Plus className="h-4 w-4 mr-2" /> Add Category
        </Button>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 p-1 glass rounded-xl w-fit">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.type;
          return (
            <button
              key={tab.type}
              onClick={() => setActiveTab(tab.type)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive ? 'bg-white/10 text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'}`}
            >
              <Icon className={`h-4 w-4 ${isActive ? tab.color : ''}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="glass-card stat-glow-blue">
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs mb-1">Total Categories</p>
            <p className="text-2xl font-bold text-blue-400">{data?.total ?? '—'}</p>
          </CardContent>
        </Card>
        <Card className="glass-card stat-glow-green">
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs mb-1">Active</p>
            <p className="text-2xl font-bold text-green-400">{data?.data.filter(c => c.isActive).length ?? '—'}</p>
          </CardContent>
        </Card>
        <Card className="glass-card stat-glow-purple">
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs mb-1">Total Items</p>
            <p className="text-2xl font-bold text-purple-400">{data?.data.reduce((a, c) => a + (c.itemCount || 0), 0) ?? '—'}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <activeTabDef.icon className={`h-4 w-4 ${activeTabDef.color}`} />
            {activeTabDef.label} Categories
            <span className="ml-auto text-sm font-normal text-muted-foreground">{data?.total ?? 0} categories</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : (
            <div className="space-y-1">
              <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-3 pb-2 text-xs text-muted-foreground uppercase tracking-wider border-b border-white/[0.05]">
                <div className="w-8 text-center">#</div>
                <div>Name</div>
                <div className="w-20 text-center">Items</div>
                <div className="w-20 text-center">Status</div>
                <div className="w-16 text-right">Actions</div>
              </div>
              {data?.data.sort((a, b) => a.sortOrder - b.sortOrder).map((cat, idx) => (
                <div key={cat.id} className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 items-center px-3 py-3 rounded-lg table-row-hover group transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs text-muted-foreground font-mono">{cat.sortOrder || idx + 1}</span>
                  </div>
                  <div className="min-w-0 flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cat.isActive ? 'bg-green-400' : 'bg-slate-600'}`} />
                    <p className="text-sm font-medium truncate">{cat.name}</p>
                  </div>
                  <div className="w-20 text-center">
                    <span className="text-sm font-semibold text-blue-400">{cat.itemCount ?? 0}</span>
                  </div>
                  <div className="w-20 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cat.isActive ? 'bg-green-500/15 text-green-400' : 'bg-slate-500/15 text-slate-400'}`}>
                      {cat.isActive ? 'Active' : 'Hidden'}
                    </span>
                  </div>
                  <div className="w-16 flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(cat)}><Edit2 className="h-3 w-3" /></Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-300" onClick={() => { if (confirm('Delete category?')) deleteMutation.mutate(cat.id); }}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              ))}
              {!data?.data.length && !isLoading && (
                <div className="text-center py-16 text-muted-foreground">
                  <Folder className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>No {activeTabDef.label.toLowerCase()} categories yet</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="glass-card border-white/10 max-w-md">
          <DialogHeader><DialogTitle>{editItem ? 'Edit Category' : `Add ${activeTabDef.label} Category`}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Name *</Label><Input className="mt-1 bg-white/5 border-white/10" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div><Label>Sort Order</Label><Input className="mt-1 bg-white/5 border-white/10" type="number" min="0" value={form.sortOrder} onChange={e => setForm(p => ({ ...p, sortOrder: e.target.value }))} /></div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="catActive" checked={form.isActive} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))} className="rounded" />
              <Label htmlFor="catActive">Active (visible to users)</Label>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button className="bg-gradient-to-r from-blue-600 to-purple-600 border-0"
                onClick={() => saveMutation.mutate({ ...form, type: activeTab, sortOrder: parseInt(form.sortOrder) || 0 })}
                disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving...' : 'Save Category'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
