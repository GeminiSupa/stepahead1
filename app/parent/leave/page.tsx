"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { PageShell } from '../../components/PageShell'
import { Card, StatCard } from '../../components/ui'

type ParentChild = {
  student_id: string
  student_name: string
}

type LeaveRow = {
  id: string
  student_id: string
  date_from: string
  date_to: string
  reason: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

export default function ParentLeavePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [children, setChildren] = useState<ParentChild[]>([])
  const [leaves, setLeaves] = useState<LeaveRow[]>([])

  const [studentId, setStudentId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)

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
      .select('student_id, students(full_name)')
      .eq('parent_id', user.id)

    if (linksError) {
      setError(linksError.message)
      setLoading(false)
      return
    }

    const mapped: ParentChild[] =
      links?.map((row: any) => ({
        student_id: row.student_id,
        student_name: row.students?.full_name ?? 'Your child',
      })) ?? []
    setChildren(mapped)

    const studentIds = mapped.map((c) => c.student_id)
    if (studentIds.length === 0) {
      setLeaves([])
      setLoading(false)
      return
    }

    const { data: leaveData, error: leaveError } = await supabase
      .from('leave_requests')
      .select('id, student_id, date_from, date_to, reason, status, created_at')
      .in('student_id', studentIds)
      .order('created_at', { ascending: false })

    if (leaveError) {
      setError(leaveError.message)
      setLoading(false)
      return
    }

    setLeaves((leaveData as LeaveRow[]) ?? [])
    setLoading(false)
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  const pendingCount = useMemo(() => leaves.filter((l) => l.status === 'pending').length, [leaves])

  const requestLeave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    if (!studentId) {
      setError('Select a child.')
      setSaving(false)
      return
    }
    if (!dateFrom || !dateTo) {
      setError('Select a start and end date.')
      setSaving(false)
      return
    }
    if (dateFrom > dateTo) {
      setError('End date must be the same or after the start date.')
      setSaving(false)
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { error: insertError } = await supabase.from('leave_requests').insert({
      student_id: studentId,
      requested_by_parent_id: user.id,
      date_from: dateFrom,
      date_to: dateTo,
      reason: reason.trim() || null,
      status: 'pending',
    })

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    setStudentId('')
    setDateFrom('')
    setDateTo('')
    setReason('')
    setSuccess('Leave request submitted.')
    await load()
    setSaving(false)
  }

  return (
    <PageShell
      title="Leave requests"
      subtitle="Request leave for your child and track approvals."
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
          <StatCard label="Children" value={loading ? '…' : String(children.length)} hint="Linked" />
          <StatCard label="Requests" value={loading ? '…' : String(leaves.length)} hint="Total" />
          <StatCard label="Pending" value={loading ? '…' : String(pendingCount)} hint="Awaiting approval" />
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {success}
          </div>
        ) : null}

        {children.length === 0 && !loading ? (
          <Card title="No child linked" subtitle="Ask admin to link your account to your child.">
            <p className="text-sm app-muted">Once linked, you can request leave here.</p>
          </Card>
        ) : (
          <Card title="Request leave" subtitle="Select child, dates, and reason.">
            <form onSubmit={requestLeave} className="grid gap-3 md:grid-cols-4">
              <div className="md:col-span-2 space-y-1">
                <label className="block text-xs font-medium text-slate-700">Child</label>
                <select
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                >
                  <option value="">Select…</option>
                  {children.map((c) => (
                    <option key={c.student_id} value={c.student_id}>
                      {c.student_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700">From</label>
                <input
                  type="date"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700">To</label>
                <input
                  type="date"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
              <div className="md:col-span-4 space-y-1">
                <label className="block text-xs font-medium text-slate-700">Reason (optional)</label>
                <input
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Fever, appointment, travel..."
                />
              </div>
              <div className="md:col-span-4 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-2xl bg-sky-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-sky-400"
                >
                  {saving ? 'Submitting…' : 'Submit request'}
                </button>
              </div>
            </form>
          </Card>
        )}

        <Card title="Your requests" subtitle="Status updates appear here after approval/rejection.">
          {loading ? (
            <p className="text-sm app-muted">Loading…</p>
          ) : leaves.length === 0 ? (
            <p className="text-sm app-muted">No leave requests yet.</p>
          ) : (
            <div className="space-y-2">
              {leaves.map((l) => {
                const childName = children.find((c) => c.student_id === l.student_id)?.student_name ?? 'Child'
                return (
                  <div key={l.id} className="rounded-2xl border app-border bg-white px-4 py-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{childName}</p>
                        <p className="text-xs app-muted">
                          {new Date(l.date_from).toLocaleDateString()} → {new Date(l.date_to).toLocaleDateString()}
                          {l.reason ? ` · ${l.reason}` : ''}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          l.status === 'approved'
                            ? 'bg-emerald-50 text-emerald-800'
                            : l.status === 'rejected'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-sky-50 text-sky-800'
                        }`}
                      >
                        {l.status}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>
    </PageShell>
  )
}

