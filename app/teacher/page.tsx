"use client"

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { PageShell } from '../components/PageShell'
import { Card, StatCard, PrimaryButton, SecondaryButton } from '../components/ui'
import Link from 'next/link'

type ClassRow = {
  id: string
  name: string
}

type Student = {
  id: string
  full_name: string
  class_id: string | null
}

type AttendanceRow = {
  id: string
  class_id: string
  status: 'present' | 'absent' | 'late' | 'therapy'
}

type ClassAttendanceSummary = {
  classId: string
  className: string
  present: number
  absent: number
  late: number
  therapy: number
}

type TimetableEntry = {
  id: string
  class_id: string
  weekday: number
  start_time: string
  end_time: string
  title: string
  is_therapy: boolean
}

export default function TeacherDashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [classes, setClasses] = useState<ClassRow[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRow[]>([])
  const [upcomingHomeworkCount, setUpcomingHomeworkCount] = useState<number | null>(null)
  const [timetableEntries, setTimetableEntries] = useState<TimetableEntry[]>([])

  useEffect(() => {
    const loadData = async () => {
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

      // Load classes where this teacher is the primary teacher
      const today = new Date().toISOString().slice(0, 10)

      const [
        { data: classData, error: classError },
        { data: studentData, error: studentError },
        { data: attendanceData, error: attendanceError },
        { data: homeworkData, error: homeworkError },
      ] = await Promise.all([
        supabase
          .from('classes')
          .select('id, name')
          .eq('primary_teacher_id', user.id)
          .order('name'),
        supabase.from('students').select('id, full_name, class_id'),
        supabase
          .from('attendance')
          .select('id, class_id, status')
          .eq('date', today),
        supabase
          .from('homework')
          .select('id, class_id, due_date')
          .gte('due_date', today),
      ])

      if (classError || studentError || attendanceError || homeworkError) {
        setError(
          classError?.message ??
            studentError?.message ??
            attendanceError?.message ??
            homeworkError?.message ??
            'Unable to load teacher data'
        )
        setLoading(false)
        return
      }

      const teacherClassIds = (classData ?? []).map((c) => c.id)

      setClasses(classData ?? [])
      setStudents(
        (studentData ?? []).filter((s) => s.class_id && teacherClassIds.includes(s.class_id))
      )
      setTodayAttendance(
        (attendanceData ?? []).filter((a) => teacherClassIds.includes(a.class_id))
      )
      setUpcomingHomeworkCount(
        (homeworkData ?? []).filter((h) => teacherClassIds.includes(h.class_id)).length
      )

      const weekday = new Date().getDay()
      const { data: ttData, error: ttError } = teacherClassIds.length
        ? await supabase
            .from('class_timetable_entries')
            .select('id, class_id, weekday, start_time, end_time, title, is_therapy')
            .in('class_id', teacherClassIds)
            .eq('weekday', weekday)
        : { data: [], error: null }

      if (ttError) {
        setError(ttError.message)
        setLoading(false)
        return
      }

      setTimetableEntries((ttData as TimetableEntry[]) ?? [])
      setLoading(false)
    }

    loadData()
  }, [router])

  const attendanceByClass: ClassAttendanceSummary[] = useMemo(() => {
    return classes.map((cls) => {
      const rows = todayAttendance.filter((a) => a.class_id === cls.id)
      return rows.reduce<ClassAttendanceSummary>(
        (acc, row) => {
          if (row.status === 'present') acc.present += 1
          else if (row.status === 'absent') acc.absent += 1
          else if (row.status === 'late') acc.late += 1
          else if (row.status === 'therapy') acc.therapy += 1
          return acc
        },
        {
          classId: cls.id,
          className: cls.name,
          present: 0,
          absent: 0,
          late: 0,
          therapy: 0,
        }
      )
    })
  }, [classes, todayAttendance])

  const todayClassCount = classes.length
  const totalStudents = students.length
  const todayTimetable = useMemo(() => {
    const byClass: Record<string, TimetableEntry[]> = {}
    timetableEntries
      .slice()
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
      .forEach((e) => {
        byClass[e.class_id] = byClass[e.class_id] ?? []
        byClass[e.class_id].push(e)
      })
    return byClass
  }, [timetableEntries])

  return (
    <PageShell
      title="Teacher Dashboard"
      subtitle="Today in your classroom — classes, little learners, and homework at a glance."
      navItems={[
        { href: '/teacher', label: 'Dashboard' },
        { href: '/teacher/timetable', label: 'Timetable' },
        { href: '/teacher/leave', label: 'Leave' },
        { href: '/teacher/portfolio', label: 'Portfolio' },
      ]}
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Today’s classes"
            value={loading ? '…' : String(todayClassCount)}
            hint="Based on your assigned classes"
            tone="sky"
            href="/teacher"
          />
          <StatCard
            label="Students"
            value={loading ? '…' : String(totalStudents)}
            hint="In your classes"
            tone="mint"
            href="/teacher"
          />
          <StatCard
            label="Upcoming homework"
            value={loading || upcomingHomeworkCount === null ? '…' : String(upcomingHomeworkCount)}
            hint="Due from today onward"
            tone="lavender"
          />
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card
            title="Today’s timetable"
            subtitle="Calm routine blocks for your classes. Therapy slots are highlighted."
            actions={<SecondaryButton href="/teacher/timetable">Open</SecondaryButton>}
            tone="sky"
          >
            {loading ? (
              <p className="text-sm app-muted">Loading timetable…</p>
            ) : classes.length === 0 ? (
              <p className="text-sm app-muted">No classes assigned yet.</p>
            ) : timetableEntries.length === 0 ? (
              <p className="text-sm app-muted">
                No timetable slots found for today. Ask admin to set up the class timetable.
              </p>
            ) : (
              <div className="space-y-3">
                {classes.map((cls) => {
                  const rows = todayTimetable[cls.id] ?? []
                  if (rows.length === 0) return null
                  return (
                    <div key={cls.id} className="rounded-2xl border app-border bg-slate-50 px-3 py-2">
                      <p className="text-sm font-semibold text-slate-900">{cls.name}</p>
                      <div className="mt-2 space-y-2">
                        {rows.slice(0, 3).map((r) => (
                          <div
                            key={r.id}
                            className={`flex items-center justify-between rounded-2xl border px-3 py-2 text-xs ${
                              r.is_therapy ? 'border-indigo-100 bg-indigo-50' : 'border-slate-200 bg-white'
                            }`}
                          >
                            <span className="font-semibold text-slate-900">{r.title}</span>
                            <span className="font-semibold text-slate-700">
                              {r.start_time.slice(0, 5)}–{r.end_time.slice(0, 5)}
                            </span>
                          </div>
                        ))}
                        {rows.length > 3 ? (
                          <p className="text-xs app-muted">+ {rows.length - 3} more…</p>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          <Card
            title="Today’s attendance"
            subtitle="Quick snapshot by class (present / late / therapy / absent)."
            tone="mint"
          >
            {loading ? (
              <p className="text-sm app-muted">Loading attendance…</p>
            ) : classes.length === 0 ? (
              <p className="text-sm app-muted">
                You don&apos;t have any classes assigned yet. Ask admin to link you as a teacher.
              </p>
            ) : (
              <div className="space-y-3">
                {attendanceByClass.map((summary) => (
                  <div key={summary.classId} className="rounded-2xl border app-border bg-slate-50 px-3 py-2">
                    <p className="text-sm font-semibold text-slate-900">{summary.className}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <Badge color="emerald" label="Present" value={summary.present} />
                      <Badge color="amber" label="Late" value={summary.late} />
                      <Badge color="sky" label="Therapy" value={summary.therapy} />
                      <Badge color="rose" label="Absent" value={summary.absent} />
                    </div>
                  </div>
                ))}
                {attendanceByClass.length === 0 ? (
                  <p className="text-sm app-muted">No attendance has been recorded yet for today.</p>
                ) : null}
              </div>
            )}
          </Card>

          <Card title="Your classes" subtitle="Roster counts for planning inclusive activities." tone="lavender">
            {loading ? (
              <p className="text-sm app-muted">Loading classes…</p>
            ) : classes.length === 0 ? (
              <p className="text-sm app-muted">No classes assigned yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {classes.map((cls) => {
                  const clsStudents = students.filter((s) => s.class_id === cls.id)
                  return (
                    <li
                      key={cls.id}
                      className="flex items-center justify-between rounded-2xl border app-border bg-white px-3 py-3"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">{cls.name}</p>
                        <p className="text-xs app-muted">
                          {clsStudents.length} student{clsStudents.length === 1 ? '' : 's'}
                        </p>
                      </div>
                      <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                        Inclusive
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </div>

        <Card
          title="Leave requests"
          subtitle="View upcoming leave requests for your class (super admin approves)."
          actions={
            <SecondaryButton href="/teacher/leave">Open</SecondaryButton>
          }
        >
          <p className="text-sm app-muted">
            Approved leave is automatically marked in attendance as Absent (Approved leave).
          </p>
        </Card>

        <Card
          title="Portfolio"
          subtitle="Upload photos/videos of classroom activities for parents."
          actions={
            <PrimaryButton href="/teacher/portfolio">Open</PrimaryButton>
          }
        >
          <p className="text-sm app-muted">
            Tip: Keep titles short (e.g. “Sensory play”, “Fine motor practice”) so parents can scan
            quickly.
          </p>
        </Card>
      </div>
    </PageShell>
  )
}

type BadgeProps = {
  color: 'emerald' | 'amber' | 'sky' | 'rose'
  label: string
  value: number
}

function Badge({ color, label, value }: BadgeProps) {
  const colors: Record<BadgeProps['color'], string> = {
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    sky: 'bg-sky-50 text-sky-700',
    rose: 'bg-rose-50 text-rose-700',
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${colors[color]}`}>
      <span>{label}</span>
      <span className="font-semibold">{value}</span>
    </span>
  )
}

