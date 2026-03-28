import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '../../services/api'

interface Reseller {
  id: number
  username: string
  email: string
  credits: number
  max_users: number
  user_count: number
  is_active: boolean
  created_at: string
  expires_at: string | null
}

export default function ResellersPage() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Reseller | null>(null)
  const [addCreditsFor, setAddCreditsFor] = useState<Reseller | null>(null)
  const [creditsAmount, setCreditsAmount] = useState('')
  const [form, setForm] = useState({
    username: '', email: '', password: '',
    credits: 10, max_users: 100,
    expires_at: '',
  })

  const { data, isLoading } = useQuery({
    queryKey: ['resellers'],
    queryFn: () => adminApi.getResellers(),
  })

  const createMutation = useMutation({
    mutationFn: (d: typeof form) => adminApi.createReseller(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['resellers'] }); setShowModal(false) },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...d }: { id: number } & Partial<typeof form>) =>
      adminApi.updateReseller(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['resellers'] }); setShowModal(false) },
  })

  const addCreditsMutation = useMutation({
    mutationFn: ({ id, amount }: { id: number; amount: number }) =>
      adminApi.addCredits(id, amount),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['resellers'] }); setAddCreditsFor(null) },
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      adminApi.updateReseller(id, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['resellers'] }),
  })

  const resellers: Reseller[] = data?.data?.resellers || []

  function openCreate() {
    setEditing(null)
    setForm({ username: '', email: '', password: '', credits: 10, max_users: 100, expires_at: '' })
    setShowModal(true)
  }

  function openEdit(r: Reseller) {
    setEditing(r)
    setForm({
      username: r.username, email: r.email || '', password: '',
      credits: r.credits, max_users: r.max_users,
      expires_at: r.expires_at ? r.expires_at.slice(0, 10) : '',
    })
    setShowModal(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (editing) {
      const payload: Record<string, unknown> = { ...form }
      if (!payload.password) delete payload.password
      updateMutation.mutate({ id: editing.id, ...payload } as { id: number } & Partial<typeof form>)
    } else {
      createMutation.mutate(form)
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Resellers</h1>
        <button onClick={openCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          + New Reseller
        </button>
      </div>

      {isLoading ? (
        <div className="text-center text-gray-400 py-10">Loading...</div>
      ) : (
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700 text-left">
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Username</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Credits</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Users</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Max Users</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Expires</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Status</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {resellers.map(r => (
                <tr key={r.id} className="hover:bg-gray-750">
                  <td className="px-4 py-3">
                    <div className="text-white font-medium">{r.username}</div>
                    <div className="text-xs text-gray-400">{r.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-yellow-400 font-semibold">{r.credits}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-300">{r.user_count}</td>
                  <td className="px-4 py-3 text-gray-300">{r.max_users}</td>
                  <td className="px-4 py-3 text-gray-300 text-sm">
                    {r.expires_at ? new Date(r.expires_at).toLocaleDateString() : '∞ Never'}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleMutation.mutate({ id: r.id, is_active: !r.is_active })}
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        r.is_active ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
                      }`}>
                      {r.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => setAddCreditsFor(r)}
                        className="text-yellow-400 hover:text-yellow-300 text-sm">Credits</button>
                      <button onClick={() => openEdit(r)}
                        className="text-blue-400 hover:text-blue-300 text-sm">Edit</button>
                    </div>
                  </td>
                </tr>
              ))}
              {resellers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No resellers found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-white mb-4">
              {editing ? 'Edit Reseller' : 'New Reseller'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Username</label>
                <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  required
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Email</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Password {editing && '(leave blank to keep)'}
                </label>
                <input type="password" value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required={!editing} minLength={8}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Credits</label>
                  <input type="number" min={0} value={form.credits}
                    onChange={e => setForm(f => ({ ...f, credits: Number(e.target.value) }))}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Max Users</label>
                  <input type="number" min={1} value={form.max_users}
                    onChange={e => setForm(f => ({ ...f, max_users: Number(e.target.value) }))}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Expires (leave blank for never)</label>
                <input type="date" value={form.expires_at}
                  onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white text-sm">Cancel</button>
                <button type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                  {editing ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Credits Modal */}
      {addCreditsFor && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold text-white mb-2">Add Credits</h2>
            <p className="text-sm text-gray-400 mb-4">
              Current balance: <span className="text-yellow-400 font-semibold">{addCreditsFor.credits}</span> credits
            </p>
            <input type="number" min={1} value={creditsAmount}
              onChange={e => setCreditsAmount(e.target.value)}
              placeholder="Amount to add"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm mb-4" />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setAddCreditsFor(null)}
                className="px-4 py-2 text-gray-400 hover:text-white text-sm">Cancel</button>
              <button
                onClick={() => {
                  if (creditsAmount && Number(creditsAmount) > 0) {
                    addCreditsMutation.mutate({ id: addCreditsFor.id, amount: Number(creditsAmount) })
                  }
                }}
                className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                Add Credits
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
