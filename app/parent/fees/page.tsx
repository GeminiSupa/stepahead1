"use client"

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { PageShell } from '../../components/PageShell'
import { Card, StatCard } from '../../components/ui'

type ParentChild = {
  student_id: string
  relationship: string | null
  student_name: string
}

type FeeRow = {
  id: string
  student_id: string
  period: string
  fee_type: string | null
  amount_due: number
  amount_paid: number
  due_date: string | null
  status: string | null
}

export default function ParentFeesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [children, setChildren] = useState<ParentChild[]>([])
  const [fees, setFees] = useState<FeeRow[]>([])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()
      if (userError || !user) {
        router.push('/login')
        return
      }

      const { data: links, error: linksError } = await supabase
        .from('parents_students')
        .select('student_id, relationship, students(full_name)')
        .eq('parent_id', user.id)

      if (linksError) {
        setError(linksError.message)
        setLoading(false)
        return
      }

      const mapped: ParentChild[] =
        links?.map((row: any) => ({
          student_id: row.student_id,
          relationship: row.relationship,
          student_name: row.students?.full_name ?? 'Your child',
        })) ?? []

      setChildren(mapped)

      if (mapped.length === 0) {
        setFees([])
        setLoading(false)
        return
      }

      const studentIds = mapped.map((c) => c.student_id)
      const { data: feesData, error: feesError } = await supabase
        .from('fees')
        .select('id, student_id, period, fee_type, amount_due, amount_paid, due_date, status')
        .in('student_id', studentIds)
        .order('due_date', { ascending: true })

      if (feesError) {
        setError(feesError.message)
        setLoading(false)
        return
      }

      setFees((feesData as FeeRow[]) ?? [])
      setLoading(false)
    }

    load()
  }, [router])

  const totalDue = useMemo(() => fees.reduce((s, f) => s + (Number(f.amount_due) || 0), 0), [fees])
  const totalPaid = useMemo(() => fees.reduce((s, f) => s + (Number(f.amount_paid) || 0), 0), [fees])

  return (
    <PageShell
      title="Fees"
      subtitle="Your child’s fee status and due dates."
      navItems={[
        { href: '/parent', label: 'Dashboard' },
        { href: '/parent/timetable', label: 'Timetable' },
        { href: '/parent/fees', label: 'Fees' },
        { href: '/parent/leave', label: 'Leave' },
        { href: '/parent/portfolio', label: 'Portfolio' },
      ]}
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Children" value={loading ? '…' : String(children.length)} hint="Linked to your account" />
          <StatCard label="Total due" value={loading ? '…' : String(totalDue)} hint="Across all fee rows" />
          <StatCard label="Total paid" value={loading ? '…' : String(totalPaid)} hint="Across all fee rows" />
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm app-muted">Loading fees…</p>
        ) : children.length === 0 ? (
          <Card title="No child linked" subtitle="Ask admin to link your account to your child.">
            <p className="text-sm app-muted">Once linked, fee status will appear here.</p>
          </Card>
        ) : fees.length === 0 ? (
          <Card title="No fees yet" subtitle="The school has not added fees yet.">
            <p className="text-sm app-muted">When fees are added, you’ll see due dates and status.</p>
          </Card>
        ) : (
          <Card title="Fee records" subtitle="Sorted by due date.">
            <div className="space-y-2">
              {fees.map((f) => {
                const childName =
                  children.find((c) => c.student_id === f.student_id)?.student_name ?? 'Child'
                return (
                  <div key={f.id} className="rounded-2xl border app-border bg-white px-4 py-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{childName}</p>
                        <p className="text-xs app-muted">
                          {f.period} · {f.fee_type ?? 'fee'} · Due:{' '}
                          {f.due_date ? new Date(f.due_date).toLocaleDateString() : '—'}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-slate-50 px-3 py-1 font-semibold text-slate-800">
                          Due {f.amount_due}
                        </span>
                        <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-800">
                          Paid {f.amount_paid}
                        </span>
                        <span className="rounded-full bg-sky-50 px-3 py-1 font-semibold text-sky-800">
                          {f.status ?? '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )}
      </div>
    </PageShell>
  )
}

