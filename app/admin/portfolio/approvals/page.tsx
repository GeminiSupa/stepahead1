"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { PageShell } from '../../../components/PageShell'
import { Badge, Card, StatCard } from '../../../components/ui'

type PortfolioRow = {
  id: string
  student_id: string
  type: string
  title: string
  description: string | null
  file_url: string | null
  created_at: string
  requires_approval: boolean
  approved: boolean
  is_visible_to_parent: boolean
  created_by_role: string | null
  created_by: string | null
}

type StudentRow = { id: string; full_name: string }

export default function AdminPortfolioApprovalsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<PortfolioRow[]>([])
  const [students, setStudents] = useState<StudentRow[]>([])
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = useCallback(async () => {
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

    const { data: rows, error: rowsError } = await supabase
      .from('portfolio_items')
      .select(
        'id, student_id, type, title, description, file_url, created_at, requires_approval, approved, is_visible_to_parent, created_by_role, created_by'
      )
      .order('created_at', { ascending: false })

    if (rowsError) {
      setError(rowsError.message)
      setLoading(false)
      return
    }

    const ids = Array.from(new Set(((rows as any[]) ?? []).map((r) => r.student_id as string)))
    const { data: studentRows, error: studentError } = ids.length
      ? await supabase.from('students').select('id, full_name').in('id', ids)
      : { data: [], error: null }

    if (studentError) {
      setError(studentError.message)
      setLoading(false)
      return
    }

    setItems((rows as PortfolioRow[]) ?? [])
    setStudents((studentRows as StudentRow[]) ?? [])
    setLoading(false)
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  const pending = useMemo(
    () => items.filter((it) => it.requires_approval && !it.approved),
    [items]
  )

  const decide = async (id: string, approved: boolean) => {
    setSavingId(id)
    setError(null)
    const { error: updateError } = await supabase
      .from('portfolio_items')
      .update({
        approved,
        // If rejected, keep it hidden from parents by default.
        is_visible_to_parent: approved ? true : false,
      })
      .eq('id', id)

    if (updateError) {
      setError(updateError.message)
      setSavingId(null)
      return
    }

    await load()
    setSavingId(null)
  }

  const studentName = (studentId: string) =>
    students.find((s) => s.id === studentId)?.full_name ?? 'Student'

  return (
    <PageShell
      title="Portfolio approvals"
      subtitle="Review items that require admin approval before parents can see them."
      navItems={[
        { href: '/admin', label: 'Admin' },
        { href: '/admin/staff', label: 'Staff' },
        { href: '/admin/students', label: 'Students' },
        { href: '/admin/parent-links', label: 'Parent links' },
        { href: '/admin/classes', label: 'Classes' },
        { href: '/admin/assignments', label: 'Assignments' },
        { href: '/admin/fees', label: 'Fees' },
        { href: '/admin/leave', label: 'Leave' },
        { href: '/admin/portfolio/approvals', label: 'Portfolio' },
      ]}
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Pending" value={loading ? '…' : String(pending.length)} hint="Needs approval" />
          <StatCard label="All items" value={loading ? '…' : String(items.length)} hint="Total" />
          <StatCard label="Students" value={loading ? '…' : String(students.length)} hint="With items" />
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <Card title="Pending approvals" subtitle="Approve to show parents, reject to keep hidden.">
          {loading ? (
            <p className="text-sm app-muted">Loading…</p>
          ) : pending.length === 0 ? (
            <p className="text-sm app-muted">No pending items.</p>
          ) : (
            <div className="space-y-3">
              {pending.slice(0, 50).map((it) => (
                <div key={it.id} className="rounded-3xl border app-border bg-white px-4 py-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {studentName(it.student_id)} · {it.title}
                      </p>
                      <p className="text-xs app-muted">
                        {new Date(it.created_at).toLocaleString()} · {it.type} ·{' '}
                        {it.created_by_role ? `by ${it.created_by_role}` : 'by staff'}
                      </p>
                      {it.description ? (
                        <p className="mt-2 text-sm app-muted">{it.description}</p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge tone="indigo">Approval required</Badge>
                        {it.is_visible_to_parent ? (
                          <Badge tone="emerald">Visible</Badge>
                        ) : (
                          <Badge tone="slate">Hidden</Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:items-end">
                      {it.file_url ? (
                        <a
                          href={it.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border app-border bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Open
                        </a>
                      ) : null}
                      <div className="flex gap-2">
                        <button
                          className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
                          disabled={savingId === it.id}
                          onClick={() => decide(it.id, true)}
                        >
                          Approve
                        </button>
                        <button
                          className="rounded-full bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-300"
                          disabled={savingId === it.id}
                          onClick={() => decide(it.id, false)}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="All items (read-only)" subtitle="Latest 20 for quick spot checks.">
          {loading ? (
            <p className="text-sm app-muted">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-sm app-muted">No items found.</p>
          ) : (
            <div className="space-y-2">
              {items.slice(0, 20).map((it) => (
                <div key={it.id} className="rounded-2xl border app-border bg-white px-4 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {studentName(it.student_id)} · {it.title}
                      </p>
                      <p className="text-xs app-muted">
                        {new Date(it.created_at).toLocaleString()} · {it.type}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {it.requires_approval ? <Badge tone="indigo">Approval required</Badge> : null}
                        {it.approved ? <Badge tone="emerald">Approved</Badge> : <Badge tone="rose">Not approved</Badge>}
                        {it.is_visible_to_parent ? (
                          <Badge tone="emerald">Visible</Badge>
                        ) : (
                          <Badge tone="slate">Hidden</Badge>
                        )}
                      </div>
                    </div>
                    {it.file_url ? (
                      <a
                        href={it.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border app-border bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Open
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </PageShell>
  )
}

