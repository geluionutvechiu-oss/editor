import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '../../services/api'

interface Plan {
  id: number
  name: string
  duration_days: number
  max_connections: number
  price: number
  credits_cost: number
  is_active: boolean
  description: string
  features: string[]
}

export default function PlansPage() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Plan | null>(null)
  const [form, setForm] = useState({
    name: '', duration_days: 30, max_connections: 1,
    price: 9.99, credits_cost: 1, description: '',
    features: ['HD Streams', 'VOD Access', 'EPG Guide'],
    is_active: true,
  })
  const [featuresInput, setFeaturesInput] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: () => adminApi.getPlans(),
  })

  const createMutation = useMutation({
    mutationFn: (d: typeof form) => adminApi.createPlan(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['plans'] }); setShowModal(false) },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...d }: { id: number } & Partial<typeof form>) =>
      adminApi.updatePlan(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['plans'] }); setShowModal(false) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => adminApi.deletePlan(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans'] }),
  })

  const plans: Plan[] = data?.data?.plans || []

  function openCreate() {
    setEditing(null)
    setForm({
      name: '', duration_days: 30, max_connections: 1,
      price: 9.99, credits_cost: 1, description: '',
      features: ['HD Streams', 'VOD Access', 'EPG Guide'],
      is_active: true,
    })
    setFeaturesInput('HD Streams\nVOD Access\nEPG Guide')
    setShowModal(true)
  }

  function openEdit(p: Plan) {
    setEditing(p)
    setForm({
      name: p.name, duration_days: p.duration_days,
      max_connections: p.max_connections, price: p.price,
      credits_cost: p.credits_cost, description: p.description || '',
      features: p.features || [], is_active: p.is_active,
    })
    setFeaturesInput((p.features || []).join('\n'))
    setShowModal(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const features = featuresInput.split('\n').map(f => f.trim()).filter(Boolean)
    const payload = { ...form, features }
    if (editing) {
      updateMutation.mutate({ id: editing.id, ...payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Subscription Plans</h1>
        <button onClick={openCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          + New Plan
        </button>
      </div>

      {isLoading ? (
        <div className="text-center text-gray-400 py-10">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map(plan => (
            <div key={plan.id}
              className={`bg-gray-800 rounded-xl border p-5 ${
                plan.is_active ? 'border-gray-700' : 'border-gray-800 opacity-60'
              }`}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                  <p className="text-sm text-gray-400">{plan.description}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  plan.is_active ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-400'
                }`}>
                  {plan.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-gray-900 rounded-lg p-3">
                  <div className="text-xs text-gray-400">Price</div>
                  <div className="text-white font-semibold">${plan.price}</div>
                </div>
                <div className="bg-gray-900 rounded-lg p-3">
                  <div className="text-xs text-gray-400">Credits Cost</div>
                  <div className="text-yellow-400 font-semibold">{plan.credits_cost}</div>
                </div>
                <div className="bg-gray-900 rounded-lg p-3">
                  <div className="text-xs text-gray-400">Duration</div>
                  <div className="text-white font-semibold">{plan.duration_days}d</div>
                </div>
                <div className="bg-gray-900 rounded-lg p-3">
                  <div className="text-xs text-gray-400">Connections</div>
                  <div className="text-white font-semibold">{plan.max_connections}</div>
                </div>
              </div>

              {plan.features?.length > 0 && (
                <ul className="space-y-1 mb-4">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-gray-300">
                      <span className="text-green-400">✓</span> {f}
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex gap-2">
                <button onClick={() => openEdit(plan)}
                  className="flex-1 text-center text-blue-400 hover:text-blue-300 text-sm border border-gray-700 rounded-lg py-1.5">
                  Edit
                </button>
                <button onClick={() => {
                    if (confirm(`Delete plan "${plan.name}"?`)) deleteMutation.mutate(plan.id)
                  }}
                  className="text-red-400 hover:text-red-300 text-sm border border-gray-700 rounded-lg px-3 py-1.5">
                  Del
                </button>
              </div>
            </div>
          ))}
          {plans.length === 0 && (
            <div className="col-span-3 text-center text-gray-500 py-10">No plans found</div>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-lg p-6 max-h-screen overflow-y-auto">
            <h2 className="text-lg font-semibold text-white mb-4">
              {editing ? 'Edit Plan' : 'New Plan'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Plan Name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required placeholder="e.g. Basic, Premium, Ultimate"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Description</label>
                <input value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Duration (days)</label>
                  <input type="number" min={1} value={form.duration_days}
                    onChange={e => setForm(f => ({ ...f, duration_days: Number(e.target.value) }))}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Max Connections</label>
                  <input type="number" min={1} value={form.max_connections}
                    onChange={e => setForm(f => ({ ...f, max_connections: Number(e.target.value) }))}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Price ($)</label>
                  <input type="number" min={0} step={0.01} value={form.price}
                    onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Credits Cost</label>
                  <input type="number" min={1} value={form.credits_cost}
                    onChange={e => setForm(f => ({ ...f, credits_cost: Number(e.target.value) }))}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Features (one per line)</label>
                <textarea value={featuresInput}
                  onChange={e => setFeaturesInput(e.target.value)}
                  rows={4}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_active}
                  onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                  className="w-4 h-4" />
                <span className="text-sm text-gray-300">Active</span>
              </label>
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
    </div>
  )
}
