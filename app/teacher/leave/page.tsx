"use client"

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { PageShell } from '../../components/PageShell'
import { Card, StatCard } from '../../components/ui'

type LeaveRow = {
  id: string
  student_id: string
  date_from: string
  date_to: string
  reason: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

type StudentRow = {
  id: string
  full_name: string
  class_id: string | null
}

type ClassRow = {
  id: string
  name: string
}

export default function TeacherLeavePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [classes, setClasses] = useState<ClassRow[]>([])
  const [students, setStudents] = useState<StudentRow[]>([])
  const [leaves, setLeaves] = useState<LeaveRow[]>([])

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

      const today = new Date().toISOString().slice(0, 10)

      const [
        { data: classData, error: classError },
        { data: studentData, error: studentError },
        { data: leaveData, error: leaveError },
      ] = await Promise.all([
        supabase.from('classes').select('id, name').eq('primary_teacher_id', user.id).order('name'),
        supabase.from('students').select('id, full_name, class_id'),
        supabase
          .from('leave_requests')
          .select('id, student_id, date_from, date_to, reason, status, created_at')
          .gte('date_to', today)
          .order('created_at', { ascending: false }),
      ])

      if (classError || studentError || leaveError) {
        setError(classError?.message ?? studentError?.message ?? leaveError?.message ?? 'Unable to load leave requests')
        setLoading(false)
        return
      }

      const myClassIds = (classData ?? []).map((c) => c.id)
      setClasses((classData as ClassRow[]) ?? [])
      setStudents(((studentData as StudentRow[]) ?? []).filter((s) => s.class_id && myClassIds.includes(s.class_id)))
      setLeaves((leaveData as LeaveRow[]) ?? [])
      setLoading(false)
    }
    load()
  }, [router])

  const pending = useMemo(() => leaves.filter((l) => l.status === 'pending'), [leaves])

  return (
    <PageShell
      title="Leave requests"
      subtitle="View upcoming leave requests for your class."
      navItems={[
        { href: '/teacher', label: 'Dashboard' },
        { href: '/teacher/timetable', label: 'Timetable' },
        { href: '/teacher/leave', label: 'Leave' },
        { href: '/teacher/portfolio', label: 'Portfolio' },
      ]}
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Your classes" value={loading ? '…' : String(classes.length)} hint="Assigned" />
          <StatCard label="Students" value={loading ? '…' : String(students.length)} hint="In your classes" />
          <StatCard label="Pending" value={loading ? '…' : String(pending.length)} hint="Awaiting admin decision" />
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <Card title="Requests" subtitle="Teachers can view; super admin approves/creates attendance automatically.">
          {loading ? (
            <p className="text-sm app-muted">Loading…</p>
          ) : leaves.length === 0 ? (
            <p className="text-sm app-muted">No leave requests found.</p>
          ) : (
            <div className="space-y-2">
              {leaves.map((l) => {
                const studentName = students.find((s) => s.id === l.student_id)?.full_name ?? 'Student'
                return (
                  <div key={l.id} className="rounded-2xl border app-border bg-white px-4 py-3">
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

