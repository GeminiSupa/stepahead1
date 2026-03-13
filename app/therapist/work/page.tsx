"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { friendlySupabaseError } from '@/lib/errorMessages'
import { PageShell } from '../../components/PageShell'
import { Card, StatCard } from '../../components/ui'
import { useToast } from '../../components/toast'

type StudentRow = { id: string; full_name: string }

type IepGoalRow = { id: string; area: string; status: string | null; student_id: string }

export default function TherapistWorkPage() {
  const router = useRouter()
  const { showToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [students, setStudents] = useState<StudentRow[]>([])
  const [goals, setGoals] = useState<IepGoalRow[]>([])

  // session form
  const [studentId, setStudentId] = useState('')
  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [therapyType, setTherapyType] = useState('Speech')
  const [sessionNotes, setSessionNotes] = useState('')

  // behavior form
  const [behaviorStudentId, setBehaviorStudentId] = useState('')
  const [behaviorType, setBehaviorType] = useState('meltdown')
  const [behaviorNotes, setBehaviorNotes] = useState('')

  // progress form
  const [goalId, setGoalId] = useState('')
  const [progressPct, setProgressPct] = useState('50')
  const [progressNote, setProgressNote] = useState('')

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

    const { data: caseload, error: caseloadError } = await supabase
      .from('therapist_students')
      .select('student_id, students(full_name)')
      .eq('therapist_id', user.id)

    if (caseloadError) {
      setError(friendlySupabaseError('Unable to load caseload.', caseloadError))
      setLoading(false)
      return
    }

    const mappedStudents: StudentRow[] =
      (caseload as any[])?.map((row) => ({
        id: row.student_id as string,
        full_name: row.students?.full_name ?? 'Student',
      })) ?? []

    setStudents(mappedStudents)

    const ids = mappedStudents.map((s) => s.id)
    const { data: goalData, error: goalError } = ids.length
      ? await supabase
          .from('iep_goals')
          .select('id, area, status, student_id')
          .in('student_id', ids)
          .order('created_at', { ascending: false })
      : { data: [], error: null }

    if (goalError) {
      setError(friendlySupabaseError('Unable to load IEP goals.', goalError))
      setLoading(false)
      return
    }

    setGoals((goalData as IepGoalRow[]) ?? [])
    setLoading(false)
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  const activeGoals = useMemo(() => goals.filter((g) => g.status === 'active'), [goals])

  const createSession = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    if (!studentId) {
      showToast('Select a student.', 'error')
      setSaving(false)
      return
    }

    const { error } = await supabase.from('therapy_sessions').insert({
      student_id: studentId,
      therapist_id: user.id,
      session_date: sessionDate,
      therapy_type: therapyType,
      notes: sessionNotes.trim() || null,
      duration_minutes: null,
    })

    if (error) {
      setError(friendlySupabaseError('Unable to save therapy session.', error))
      showToast('Unable to save session.', 'error')
      setSaving(false)
      return
    }

    setSuccess('Therapy session saved.')
    showToast('Session saved.', 'success')
    setSessionNotes('')
    setSaving(false)
  }

  const createBehaviorLog = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    if (!behaviorStudentId) {
      showToast('Select a student.', 'error')
      setSaving(false)
      return
    }

    const { error } = await supabase.from('behavior_logs').insert({
      student_id: behaviorStudentId,
      date_time: new Date().toISOString(),
      behavior_type: behaviorType,
      notes: behaviorNotes.trim() || null,
      created_by: user.id,
    })

    if (error) {
      setError(friendlySupabaseError('Unable to save behavior log.', error))
      showToast('Unable to save behavior log.', 'error')
      setSaving(false)
      return
    }

    setSuccess('Behavior log saved.')
    showToast('Behavior log saved.', 'success')
    setBehaviorNotes('')
    setSaving(false)
  }

  const addProgress = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    if (!goalId) {
      showToast('Select an IEP goal.', 'error')
      setSaving(false)
      return
    }

    const pct = Number(progressPct)
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      showToast('Progress must be between 0 and 100.', 'error')
      setSaving(false)
      return
    }

    const { error } = await supabase.from('iep_progress_entries').insert({
      goal_id: goalId,
      progress_pct: pct,
      note: progressNote.trim() || null,
      recorded_by: user.id,
      recorded_at: new Date().toISOString(),
    })

    if (error) {
      setError(friendlySupabaseError('Unable to save IEP progress.', error))
      showToast('Unable to save progress.', 'error')
      setSaving(false)
      return
    }

    setSuccess('IEP progress saved.')
    showToast('Progress saved.', 'success')
    setProgressNote('')
    setSaving(false)
  }

  return (
    <PageShell
      title="Therapist work"
      subtitle="Log therapy sessions, behavior events, and IEP progress for your caseload."
      navItems={[
        { href: '/therapist', label: 'Dashboard' },
        { href: '/therapist/work', label: 'Work' },
        { href: '/therapist/portfolio', label: 'Portfolio' },
      ]}
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Caseload" value={loading ? '…' : String(students.length)} hint="Assigned students" />
          <StatCard label="Active goals" value={loading ? '…' : String(activeGoals.length)} hint="From IEP" />
          <StatCard label="Status" value={saving ? 'Saving…' : 'Ready'} hint="Forms" />
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

        {loading ? (
          <Card title="Loading…" subtitle="Fetching your caseload.">
            <p className="text-sm app-muted">Please wait…</p>
          </Card>
        ) : students.length === 0 ? (
          <Card title="No caseload assigned" subtitle="Ask admin to assign students to you.">
            <p className="text-sm app-muted">
              Admin can assign students in <code className="rounded bg-slate-100 px-1 py-0.5">Admin → Assignments</code>.
            </p>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Log therapy session" subtitle="Record today’s session for one student.">
              <form onSubmit={createSession} className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Student</label>
                  <select
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                  >
                    <option value="">Select…</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Date</label>
                  <input
                    type="date"
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Therapy type</label>
                  <select
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                    value={therapyType}
                    onChange={(e) => setTherapyType(e.target.value)}
                  >
                    <option value="Speech">Speech</option>
                    <option value="OT">OT</option>
                    <option value="PT">PT</option>
                    <option value="ABA">ABA</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="md:col-span-2 space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Notes (optional)</label>
                  <input
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                    value={sessionNotes}
                    onChange={(e) => setSessionNotes(e.target.value)}
                    placeholder="Activities, response, plan…"
                  />
                </div>

                <div className="md:col-span-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-2xl bg-sky-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-sky-400"
                  >
                    Save session
                  </button>
                </div>
              </form>
            </Card>

            <Card title="Log behavior event" subtitle="Record a behavior incident for ABC review later.">
              <form onSubmit={createBehaviorLog} className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Student</label>
                  <select
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                    value={behaviorStudentId}
                    onChange={(e) => setBehaviorStudentId(e.target.value)}
                  >
                    <option value="">Select…</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Type</label>
                  <select
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                    value={behaviorType}
                    onChange={(e) => setBehaviorType(e.target.value)}
                  >
                    <option value="meltdown">Meltdown</option>
                    <option value="elopement">Elopement</option>
                    <option value="aggression">Aggression</option>
                    <option value="self-injury">Self-injury</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="md:col-span-2 space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Notes (optional)</label>
                  <input
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                    value={behaviorNotes}
                    onChange={(e) => setBehaviorNotes(e.target.value)}
                    placeholder="Trigger, response, consequence…"
                  />
                </div>

                <div className="md:col-span-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    Save log
                  </button>
                </div>
              </form>
            </Card>

            <Card title="Add IEP progress" subtitle="Record progress % against a goal.">
              <form onSubmit={addProgress} className="grid gap-3 md:grid-cols-2">
                <div className="md:col-span-2 space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Goal</label>
                  <select
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                    value={goalId}
                    onChange={(e) => setGoalId(e.target.value)}
                  >
                    <option value="">Select goal…</option>
                    {activeGoals.map((g) => {
                      const sName = students.find((s) => s.id === g.student_id)?.full_name ?? 'Student'
                      return (
                        <option key={g.id} value={g.id}>
                          {sName} — {g.area}
                        </option>
                      )
                    })}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Progress %</label>
                  <input
                    inputMode="numeric"
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                    value={progressPct}
                    onChange={(e) => setProgressPct(e.target.value)}
                    placeholder="0-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Note (optional)</label>
                  <input
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                    value={progressNote}
                    onChange={(e) => setProgressNote(e.target.value)}
                    placeholder="What improved / what to target next…"
                  />
                </div>

                <div className="md:col-span-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
                  >
                    Save progress
                  </button>
                </div>
              </form>
            </Card>
          </div>
        )}
      </div>
    </PageShell>
  )
}

