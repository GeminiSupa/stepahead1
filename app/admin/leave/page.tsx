"use client"

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { friendlySupabaseError } from '@/lib/errorMessages'
import { PageShell } from '../../components/PageShell'
import { Card, StatCard } from '../../components/ui'
import { useToast } from '../../components/toast'

type LeaveRow = {
  id: string
  student_id: string
  requested_by_parent_id: string
  date_from: string
  date_to: string
  reason: string | null
  status: 'pending' | 'approved' | 'rejected'
  decision_note: string | null
  created_at: string
}

type StudentRow = {
  id: string
  full_name: string
}

export default function AdminLeavePage() {
  const router = useRouter()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [leaves, setLeaves] = useState<LeaveRow[]>([])
  const [students, setStudents] = useState<StudentRow[]>([])
  const [decisionNote, setDecisionNote] = useState<Record<string, string>>({})
  const [decidingId, setDecidingId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)

    const [{ data: leaveData, error: leaveError }, { data: studentData, error: studentError }] =
      await Promise.all([
        supabase
          .from('leave_requests')
          .select('id, student_id, requested_by_parent_id, date_from, date_to, reason, status, decision_note, created_at')
          .order('created_at', { ascending: false }),
        supabase.from('students').select('id, full_name').order('full_name'),
      ])

    if (leaveError || studentError) {
      const raw = leaveError ?? studentError
      setError(friendlySupabaseError('Unable to load leave requests.', raw))
      setLoading(false)
      return
    }

    setLeaves((leaveData as LeaveRow[]) ?? [])
    setStudents((studentData as StudentRow[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const pending = useMemo(() => leaves.filter((l) => l.status === 'pending'), [leaves])

  const decide = async (id: string, decision: 'approved' | 'rejected') => {
    setDecidingId(id)
    setError(null)
    setSuccess(null)

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError || !session) {
      setError('Please sign in again.')
      setDecidingId(null)
      return
    }

    const res = await fetch('/api/admin/leave/decide', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        leaveRequestId: id,
        decision,
        decisionNote: decisionNote[id] || '',
      }),
    })

    const json = await res.json()
    if (!res.ok) {
      setError(friendlySupabaseError('Unable to decide request.', json?.error))
      showToast('Unable to decide request.', 'error')
      setDecidingId(null)
      return
    }

    setSuccess(`Request ${decision}. Attendance updated automatically when approved.`)
    showToast(`Leave ${decision}.`, 'success')
    await load()
    setDecidingId(null)
  }

  return (
    <PageShell
      title="Leave management"
      subtitle="Approve/reject leave requests. Approved leave automatically marks attendance as Absent (Approved leave)."
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
          <StatCard label="Requests" value={loading ? '…' : String(leaves.length)} hint="Total" />
          <StatCard label="Pending" value={loading ? '…' : String(pending.length)} hint="Need decision" />
          <StatCard label="Status" value={decidingId ? 'Working…' : 'Ready'} hint="Approve/reject" />
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

        <Card title="Requests" subtitle="Pending requests appear first.">
          {loading ? (
            <p className="text-sm app-muted">Loading…</p>
          ) : leaves.length === 0 ? (
            <p className="text-sm app-muted">No leave requests yet.</p>
          ) : (
            <div className="space-y-3">
              {leaves.map((l) => {
                const studentName = students.find((s) => s.id === l.student_id)?.full_name ?? 'Student'
                const isPending = l.status === 'pending'
                return (
                  <div key={l.id} className="rounded-2xl border app-border bg-white p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{studentName}</p>
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

                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-slate-700">Decision note (optional)</label>
                        <input
                          className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                          value={decisionNote[l.id] ?? l.decision_note ?? ''}
                          onChange={(e) => setDecisionNote((m) => ({ ...m, [l.id]: e.target.value }))}
                          placeholder="e.g. Approved (doctor appointment)"
                          disabled={!isPending}
                        />
                      </div>
                      <div className="flex items-end gap-2">
                        <button
                          disabled={!isPending || decidingId === l.id}
                          onClick={() => decide(l.id, 'approved')}
                          className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
                        >
                          Approve
                        </button>
                        <button
                          disabled={!isPending || decidingId === l.id}
                          onClick={() => decide(l.id, 'rejected')}
                          className="w-full rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-300"
                        >
                          Reject
                        </button>
                      </div>
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

