"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { friendlySupabaseError } from '@/lib/errorMessages'
import { PageShell } from '../../components/PageShell'
import { Card, StatCard } from '../../components/ui'
import { useToast } from '../../components/toast'

type UserRow = { id: string; full_name: string | null; email: string | null }
type ClassRow = { id: string; name: string; grade_level: string | null; room: string | null; primary_teacher_id: string | null }
type StudentRow = { id: string; full_name: string; class_id: string | null }

type TherapistLinkRow = {
  id: string
  therapist_id: string
  student_id: string
  start_date: string | null
  end_date: string | null
}

export default function AdminAssignmentsPage() {
  const { showToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [teachers, setTeachers] = useState<UserRow[]>([])
  const [therapists, setTherapists] = useState<UserRow[]>([])
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [students, setStudents] = useState<StudentRow[]>([])
  const [therapistLinks, setTherapistLinks] = useState<TherapistLinkRow[]>([])

  // teacher assignment
  const [selectedClassId, setSelectedClassId] = useState('')
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | ''>('')
  const [savingTeacher, setSavingTeacher] = useState(false)

  // therapist assignment
  const [selectedTherapistId, setSelectedTherapistId] = useState<string | ''>('')
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [savingTherapist, setSavingTherapist] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const [
      { data: teacherData, error: teacherError },
      { data: therapistData, error: therapistError },
      { data: classData, error: classError },
      { data: studentData, error: studentError },
      { data: linkData, error: linkError },
    ] = await Promise.all([
      supabase.from('users').select('id, full_name, email').eq('role', 'teacher').order('full_name'),
      supabase.from('users').select('id, full_name, email').eq('role', 'therapist').order('full_name'),
      supabase
        .from('classes')
        .select('id, name, grade_level, room, primary_teacher_id')
        .order('name'),
      supabase.from('students').select('id, full_name, class_id').order('full_name'),
      supabase
        .from('therapist_students')
        .select('id, therapist_id, student_id, start_date, end_date')
        .order('created_at', { ascending: false }),
    ])

    const raw = teacherError ?? therapistError ?? classError ?? studentError ?? linkError
    if (raw) {
      setError(friendlySupabaseError('Unable to load assignments data.', raw))
      setLoading(false)
      return
    }

    setTeachers((teacherData as UserRow[]) ?? [])
    setTherapists((therapistData as UserRow[]) ?? [])
    setClasses((classData as ClassRow[]) ?? [])
    setStudents((studentData as StudentRow[]) ?? [])
    setTherapistLinks((linkData as TherapistLinkRow[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const selectedClass = useMemo(
    () => classes.find((c) => c.id === selectedClassId) ?? null,
    [classes, selectedClassId]
  )

  const assignTeacher = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedClassId) {
      showToast('Select a class.', 'error')
      return
    }
    setSavingTeacher(true)
    setError(null)

    const { error } = await supabase
      .from('classes')
      .update({ primary_teacher_id: selectedTeacherId || null })
      .eq('id', selectedClassId)

    if (error) {
      setError(friendlySupabaseError('Unable to assign teacher.', error))
      showToast('Unable to assign teacher.', 'error')
      setSavingTeacher(false)
      return
    }

    showToast('Teacher assignment saved.', 'success')
    await load()
    setSavingTeacher(false)
  }

  const assignTherapist = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTherapistId) {
      showToast('Select a therapist.', 'error')
      return
    }
    if (!selectedStudentId) {
      showToast('Select a student.', 'error')
      return
    }
    setSavingTherapist(true)
    setError(null)

    const { error } = await supabase.from('therapist_students').insert({
      therapist_id: selectedTherapistId,
      student_id: selectedStudentId,
      start_date: startDate || null,
    })

    if (error) {
      setError(friendlySupabaseError('Unable to assign student to therapist.', error))
      showToast('Unable to assign student to therapist.', 'error')
      setSavingTherapist(false)
      return
    }

    showToast('Student assigned to therapist.', 'success')
    setSelectedStudentId('')
    setStartDate('')
    await load()
    setSavingTherapist(false)
  }

  const removeTherapistLink = async (id: string) => {
    if (!window.confirm('Remove this therapist ↔ student assignment?')) return
    setError(null)
    const { error } = await supabase.from('therapist_students').delete().eq('id', id)
    if (error) {
      setError(friendlySupabaseError('Unable to remove assignment.', error))
      showToast('Unable to remove assignment.', 'error')
      return
    }
    showToast('Assignment removed.', 'success')
    await load()
  }

  const teacherName = (id: string | null) =>
    id ? teachers.find((t) => t.id === id)?.full_name ?? 'Teacher' : 'Unassigned'
  const therapistName = (id: string) => therapists.find((t) => t.id === id)?.full_name ?? 'Therapist'
  const studentName = (id: string) => students.find((s) => s.id === id)?.full_name ?? 'Student'

  return (
    <PageShell
      title="Assignments"
      subtitle="Assign teachers to classes and students to therapists so dashboards show the right caseloads."
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
          <StatCard label="Teachers" value={loading ? '…' : String(teachers.length)} hint="role=teacher" />
          <StatCard label="Therapists" value={loading ? '…' : String(therapists.length)} hint="role=therapist" />
          <StatCard label="Links" value={loading ? '…' : String(therapistLinks.length)} hint="therapist_students" />
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Assign teacher to class" subtitle="This powers the teacher dashboard (classes where primary_teacher_id = teacher).">
            <form onSubmit={assignTeacher} className="grid gap-3 md:grid-cols-3">
              <div className="md:col-span-2 space-y-1">
                <label className="block text-xs font-medium text-slate-700">Class</label>
                <select
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                  value={selectedClassId}
                  onChange={(e) => {
                    const id = e.target.value
                    setSelectedClassId(id)
                    const c = classes.find((x) => x.id === id)
                    setSelectedTeacherId((c?.primary_teacher_id as any) ?? '')
                  }}
                >
                  <option value="">Select class…</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.room ? ` — ${c.room}` : ''}
                    </option>
                  ))}
                </select>
                {selectedClass ? (
                  <p className="text-xs app-muted">
                    Current teacher: <span className="font-semibold text-slate-800">{teacherName(selectedClass.primary_teacher_id)}</span>
                  </p>
                ) : null}
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700">Teacher</label>
                <select
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {(t.full_name || 'Teacher') + (t.email ? ` — ${t.email}` : '')}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-3 flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={savingTeacher}
                  className="rounded-2xl bg-sky-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-sky-400"
                >
                  {savingTeacher ? 'Saving…' : 'Save assignment'}
                </button>
              </div>
            </form>
          </Card>

          <Card title="Assign student to therapist" subtitle="This powers the therapist caseload (therapist_students).">
            <form onSubmit={assignTherapist} className="grid gap-3 md:grid-cols-4">
              <div className="md:col-span-2 space-y-1">
                <label className="block text-xs font-medium text-slate-700">Therapist</label>
                <select
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                  value={selectedTherapistId}
                  onChange={(e) => setSelectedTherapistId(e.target.value)}
                >
                  <option value="">Select therapist…</option>
                  {therapists.map((t) => (
                    <option key={t.id} value={t.id}>
                      {(t.full_name || 'Therapist') + (t.email ? ` — ${t.email}` : '')}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2 space-y-1">
                <label className="block text-xs font-medium text-slate-700">Student</label>
                <select
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                >
                  <option value="">Select student…</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2 space-y-1">
                <label className="block text-xs font-medium text-slate-700">Start date (optional)</label>
                <input
                  type="date"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="md:col-span-4 flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={savingTherapist}
                  className="rounded-2xl bg-sky-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-sky-400"
                >
                  {savingTherapist ? 'Assigning…' : 'Assign student'}
                </button>
              </div>
            </form>
          </Card>
        </div>

        <Card title="Therapist assignments" subtitle="Recent links (remove if assigned by mistake).">
          {loading ? (
            <p className="text-sm app-muted">Loading…</p>
          ) : therapistLinks.length === 0 ? (
            <p className="text-sm app-muted">No therapist ↔ student assignments yet.</p>
          ) : (
            <div className="space-y-2">
              {therapistLinks.slice(0, 50).map((l) => (
                <div key={l.id} className="rounded-2xl border app-border bg-white px-4 py-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {studentName(l.student_id)}
                      </p>
                      <p className="text-xs app-muted">
                        Therapist: {therapistName(l.therapist_id)}
                        {l.start_date ? ` · start ${new Date(l.start_date).toLocaleDateString()}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeTherapistLink(l.id)}
                      className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                    >
                      Remove
                    </button>
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

