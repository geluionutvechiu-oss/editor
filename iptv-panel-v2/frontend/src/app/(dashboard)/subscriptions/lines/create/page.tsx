'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { subscriptionLinesApi, packagesApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { toast } from '@/components/ui/toaster'
import type { Package, PaginatedResponse } from '@/types'

const schema = z.object({
  username: z.string().min(4).max(32),
  password: z.string().min(4),
  package_id: z.string().optional(),
  max_connections: z.coerce.number().min(1).max(10),
  is_active: z.boolean(),
  is_trial: z.boolean(),
  expires_at: z.string().optional(),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export default function CreateLinePage() {
  const router = useRouter()

  const { data: packagesData } = useQuery({
    queryKey: ['packages-list'],
    queryFn: () => packagesApi.list({ per_page: 100 }),
  })

  const packages = (packagesData?.data as PaginatedResponse<Package>)?.data ?? []

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      max_connections: 1,
      is_active: true,
      is_trial: false,
    },
  })

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => subscriptionLinesApi.create(data),
    onSuccess: () => {
      toast('Line created successfully', 'success')
      router.push('/subscriptions/lines')
    },
    onError: () => {
      toast('Failed to create line', 'error')
    },
  })

  const onSubmit = (data: FormData) => {
    mutation.mutate({
      ...data,
      package_id: data.package_id ? Number(data.package_id) : undefined,
    })
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/subscriptions/lines">
          <Button variant="ghost" size="icon">
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Create Subscription Line</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Add a new IPTV subscription line</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Username"
              placeholder="john_doe"
              error={errors.username?.message}
              {...register('username')}
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              error={errors.password?.message}
              {...register('password')}
            />
          </div>

          <Select
            label="Package"
            options={packages.map((p) => ({ value: p.id, label: `${p.name} - $${p.price}/mo` }))}
            placeholder="Select a package"
            {...register('package_id')}
          />

          <Input
            label="Max Connections"
            type="number"
            min={1}
            max={10}
            error={errors.max_connections?.message}
            {...register('max_connections')}
          />

          <Input
            label="Expiry Date"
            type="datetime-local"
            {...register('expires_at')}
          />

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-border bg-input w-4 h-4 accent-primary"
                {...register('is_active')}
              />
              <span className="text-sm text-foreground">Active</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-border bg-input w-4 h-4 accent-primary"
                {...register('is_trial')}
              />
              <span className="text-sm text-foreground">Trial</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Notes</label>
            <textarea
              className="w-full px-3 py-2.5 bg-input border border-border rounded-lg text-foreground placeholder-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              rows={3}
              placeholder="Optional notes..."
              {...register('notes')}
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" isLoading={mutation.isPending}>
              Create Line
            </Button>
            <Link href="/subscriptions/lines">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
