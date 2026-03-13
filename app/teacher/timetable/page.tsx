"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { PageShell } from "../../components/PageShell"
import { Card, StatCard, SecondaryButton } from "../../components/ui"

type ClassRow = { id: string; name: string }
type TimetableEntry = {
  id: string
  class_id: string
  weekday: number
  start_time: string
  end_time: string
  title: string
  is_therapy: boolean
}

const WEEKDAYS: { value: number; label: string }[] = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
]

export default function TeacherTimetablePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [classes, setClasses] = useState<ClassRow[]>([])
  const [entries, setEntries] = useState<TimetableEntry[]>([])

  const [weekday, setWeekday] = useState<number>(() => new Date().getDay())
  const [classId, setClassId] = useState<string>("")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) {
      router.push("/login")
      return
    }

    const { data: classData, error: classError } = await supabase
      .from("classes")
      .select("id, name")
      .eq("primary_teacher_id", user.id)
      .order("name")

    if (classError) {
      setError(classError.message)
      setLoading(false)
      return
    }

    const myClasses = (classData as ClassRow[]) ?? []
    setClasses(myClasses)

    const myClassIds = myClasses.map((c) => c.id)
    const { data: entryData, error: entryError } = myClassIds.length
      ? await supabase
          .from("class_timetable_entries")
          .select("id, class_id, weekday, start_time, end_time, title, is_therapy")
          .in("class_id", myClassIds)
      : { data: [], error: null }

    if (entryError) {
      setError(entryError.message)
      setLoading(false)
      return
    }

    setEntries((entryData as TimetableEntry[]) ?? [])
    setLoading(false)
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    return entries
      .filter((e) => e.weekday === weekday && (!classId || e.class_id === classId))
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
  }, [entries, weekday, classId])

  const weekdayLabel = useMemo(
    () => WEEKDAYS.find((w) => w.value === weekday)?.label ?? "Day",
    [weekday],
  )

  const className = useMemo(
    () => classes.find((c) => c.id === classId)?.name ?? null,
    [classes, classId],
  )

  return (
    <PageShell
      title="Timetable"
      subtitle="A calm, kid-friendly daily flow for your assigned classes."
      navItems={[
        { href: "/teacher", label: "Dashboard" },
        { href: "/teacher/timetable", label: "Timetable" },
        { href: "/teacher/leave", label: "Leave" },
        { href: "/teacher/portfolio", label: "Portfolio" },
      ]}
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Classes" value={loading ? "…" : String(classes.length)} hint="Assigned" />
          <StatCard label="Day" value={weekdayLabel} hint="Pick a weekday" />
          <StatCard label="Slots" value={loading ? "…" : String(filtered.length)} hint="For selected filters" />
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <Card
          title="Filters"
          subtitle="Choose a class (optional) and a day to preview the schedule."
          actions={<SecondaryButton href="/teacher">Back</SecondaryButton>}
        >
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700">Class</label>
              <select
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
              >
                <option value="">All my classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700">Weekday</label>
              <select
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
                value={weekday}
                onChange={(e) => setWeekday(Number(e.target.value))}
              >
                {WEEKDAYS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700">Showing</label>
              <div className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm">
                <p className="font-semibold text-slate-900">{className ?? "All classes"}</p>
                <p className="text-xs app-muted">{weekdayLabel}</p>
              </div>
            </div>
          </div>
        </Card>

        <Card title="Schedule" subtitle="Therapy blocks are highlighted in purple.">
          {loading ? (
            <p className="text-sm app-muted">Loading timetable…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm app-muted">
              No timetable slots found. Ask admin to set up the class timetable.
            </p>
          ) : (
            <div className="space-y-2">
              {filtered.map((e) => (
                <div key={e.id} className="rounded-2xl border app-border bg-white px-4 py-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{e.title}</p>
                      <p className="text-xs app-muted">
                        {e.start_time.slice(0, 5)} – {e.end_time.slice(0, 5)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {e.is_therapy ? (
                        <span className="rounded-full bg-indigo-50 px-3 py-1 font-semibold text-indigo-700">
                          Therapy
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-50 px-3 py-1 font-semibold text-slate-700">
                          Class
                        </span>
                      )}
                      <span className="rounded-full bg-sky-50 px-3 py-1 font-semibold text-sky-800">
                        {classes.find((c) => c.id === e.class_id)?.name ?? "Class"}
                      </span>
                    </div>
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

