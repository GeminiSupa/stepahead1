"use client"

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { friendlySupabaseError } from '@/lib/errorMessages'
import { PageShell } from '../../components/PageShell'
import { Card, StatCard } from '../../components/ui'
import { useToast } from '../../components/toast'

type StudentRow = {
  id: string
  full_name: string
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

function currentPeriod() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${yyyy}-${mm}`
}

export default function AdminFeesPage() {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [students, setStudents] = useState<StudentRow[]>([])
  const [fees, setFees] = useState<FeeRow[]>([])

  const [studentId, setStudentId] = useState('')
  const [period, setPeriod] = useState(currentPeriod())
  const [feeType, setFeeType] = useState('tuition')
  const [amountDue, setAmountDue] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)

    const [{ data: studentsData, error: studentsError }, { data: feesData, error: feesError }] =
      await Promise.all([
        supabase.from('students').select('id, full_name').order('full_name'),
        supabase.from('fees').select('id, student_id, period, fee_type, amount_due, amount_paid, due_date, status').order('due_date', { ascending: true }),
      ])

    if (studentsError || feesError) {
      const raw = studentsError ?? feesError
      setError(friendlySupabaseError('Unable to load fees.', raw))
      setLoading(false)
      return
    }

    setStudents((studentsData as StudentRow[]) ?? [])
    setFees((feesData as FeeRow[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const feesForPeriod = useMemo(() => fees.filter((f) => f.period === period), [fees, period])
  const totalDue = useMemo(
    () => feesForPeriod.reduce((sum, f) => sum + (Number(f.amount_due) || 0), 0),
    [feesForPeriod]
  )
  const totalPaid = useMemo(
    () => feesForPeriod.reduce((sum, f) => sum + (Number(f.amount_paid) || 0), 0),
    [feesForPeriod]
  )

  const createFee = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setError(null)
    setSuccess(null)

    const due = Number(amountDue)
    if (!studentId) {
      setError('Select a student.')
      setIsSaving(false)
      return
    }
    if (!period.trim()) {
      setError('Period is required (e.g., 2026-03).')
      setIsSaving(false)
      return
    }
    if (!Number.isFinite(due) || due <= 0) {
      setError('Amount due must be a positive number.')
      setIsSaving(false)
      return
    }

    const { error: insertError } = await supabase.from('fees').insert({
      student_id: studentId,
      period: period.trim(),
      fee_type: feeType.trim() || null,
      amount_due: due,
      amount_paid: 0,
      due_date: dueDate ? dueDate : null,
      status: 'unpaid',
    })

    if (insertError) {
      setError(friendlySupabaseError('Could not create fee.', insertError))
      showToast('Could not create fee.', 'error')
      setIsSaving(false)
      return
    }

    setSuccess('Fee created.')
    showToast('Fee created.', 'success')
    setAmountDue('')
    setDueDate('')
    await load()
    setIsSaving(false)
  }

  return (
    <PageShell
      title="Fees"
      subtitle="Create monthly/term fees, track status, and share fee status with parents."
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
          <StatCard label="Period" value={period} hint="Current filter" />
          <StatCard label="Total due" value={loading ? '…' : String(totalDue)} hint="For selected period" />
          <StatCard label="Total paid" value={loading ? '…' : String(totalPaid)} hint="For selected period" />
        </div>

        <Card title="Create fee" subtitle="Add a fee row for one student and one period.">
          <form onSubmit={createFee} className="grid gap-3 md:grid-cols-5">
            <div className="md:col-span-2 space-y-1">
              <label className="block text-xs font-medium text-slate-700">Student</label>
              <select
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
              >
                <option value="">Select student…</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700">Period</label>
              <input
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                placeholder="YYYY-MM"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700">Type</label>
              <select
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                value={feeType}
                onChange={(e) => setFeeType(e.target.value)}
              >
                <option value="tuition">Tuition</option>
                <option value="transport">Transport</option>
                <option value="therapy">Therapy</option>
                <option value="misc">Misc</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700">Amount due</label>
              <input
                inputMode="decimal"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                value={amountDue}
                onChange={(e) => setAmountDue(e.target.value)}
                placeholder="e.g. 12000"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700">Due date</label>
              <input
                type="date"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <div className="md:col-span-5 flex justify-end">
              <button
                disabled={isSaving}
                className="rounded-2xl bg-sky-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-sky-400"
                type="submit"
              >
                {isSaving ? 'Saving…' : 'Create fee'}
              </button>
            </div>
          </form>

          {success ? (
            <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {success}
            </div>
          ) : null}
          {error ? (
            <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
        </Card>

        <Card
          title="Fees list"
          subtitle="All fee rows (filter by period above)."
          actions={
            <button
              onClick={load}
              className="rounded-full border app-border bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Refresh
            </button>
          }
        >
          {loading ? (
            <p className="text-sm app-muted">Loading fees…</p>
          ) : feesForPeriod.length === 0 ? (
            <p className="text-sm app-muted">No fee rows for this period yet.</p>
          ) : (
            <div className="space-y-2">
              {feesForPeriod.map((f) => {
                const studentName = students.find((s) => s.id === f.student_id)?.full_name ?? 'Student'
                return (
                  <div key={f.id} className="rounded-2xl border app-border bg-white px-4 py-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{studentName}</p>
                        <p className="text-xs app-muted">
                          {f.fee_type ? `Type: ${f.fee_type}` : 'Type: —'} · Due:{' '}
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
          )}
        </Card>
      </div>
    </PageShell>
  )
}

