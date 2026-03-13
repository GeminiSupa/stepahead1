"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { PageShell } from "../../components/PageShell"
import { Card, StatCard, SecondaryButton } from "../../components/ui"

type ParentChild = {
  student_id: string
  student_name: string
  class_id: string | null
  class_name: string | null
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

const WEEKDAYS: { value: number; label: string }[] = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
]

export default function ParentTimetablePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [children, setChildren] = useState<ParentChild[]>([])
  const [entries, setEntries] = useState<TimetableEntry[]>([])

  const [weekday, setWeekday] = useState<number>(() => new Date().getDay())

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

    const { data: links, error: linksError } = await supabase
      .from("parents_students")
      .select("student_id, students(full_name, class_id, classes(name))")
      .eq("parent_id", user.id)

    if (linksError) {
      setError(linksError.message)
      setLoading(false)
      return
    }

    const mapped: ParentChild[] =
      links?.map((row: any) => ({
        student_id: row.student_id,
        student_name: row.students?.full_name ?? "Your child",
        class_id: row.students?.class_id ?? null,
        class_name: row.students?.classes?.name ?? null,
      })) ?? []

    setChildren(mapped)

    const classIds = Array.from(
      new Set(mapped.map((c) => c.class_id).filter(Boolean) as string[]),
    )

    const { data: entryData, error: entryError } = classIds.length
      ? await supabase
          .from("class_timetable_entries")
          .select("id, class_id, weekday, start_time, end_time, title, is_therapy")
          .in("class_id", classIds)
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

  const weekdayLabel = useMemo(
    () => WEEKDAYS.find((w) => w.value === weekday)?.label ?? "Day",
    [weekday],
  )

  const entriesByClass = useMemo(() => {
    const map: Record<string, TimetableEntry[]> = {}
    entries
      .filter((e) => e.weekday === weekday)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
      .forEach((e) => {
        map[e.class_id] = map[e.class_id] ?? []
        map[e.class_id].push(e)
      })
    return map
  }, [entries, weekday])

  const classCount = useMemo(() => new Set(children.map((c) => c.class_id).filter(Boolean)).size, [children])

  return (
    <PageShell
      title="Timetable"
      subtitle="A simple, kid-friendly daily routine for your child’s class."
      navItems={[
        { href: "/parent", label: "Dashboard" },
        { href: "/parent/timetable", label: "Timetable" },
        { href: "/parent/fees", label: "Fees" },
        { href: "/parent/leave", label: "Leave" },
        { href: "/parent/portfolio", label: "Portfolio" },
      ]}
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Children" value={loading ? "…" : String(children.length)} hint="Linked" />
          <StatCard label="Classes" value={loading ? "…" : String(classCount)} hint="With a timetable" />
          <StatCard label="Day" value={weekdayLabel} hint="Pick a weekday" />
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <Card title="Choose day" subtitle="You can review the routine for any weekday." actions={<SecondaryButton href="/parent">Back</SecondaryButton>}>
          <div className="max-w-sm">
            <label className="block text-xs font-medium text-slate-700">Weekday</label>
            <select
              className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-sky-100 focus:border-sky-600 focus:ring-2"
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
        </Card>

        <Card
          title="Kid-friendly schedule"
          subtitle="Bigger blocks, simple labels. Therapy is highlighted."
        >
          {loading ? (
            <p className="text-sm app-muted">Loading timetable…</p>
          ) : children.length === 0 ? (
            <p className="text-sm app-muted">Ask the school admin to link your account to your child.</p>
          ) : (
            <div className="space-y-6">
              {children.map((child) => {
                const cid = child.class_id
                const classEntries = cid ? entriesByClass[cid] ?? [] : []
                return (
                  <div key={child.student_id} className="rounded-3xl border app-border bg-white/95 p-4 shadow-sm">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{child.student_name}</p>
                        <p className="text-xs app-muted">{child.class_name ? `Class: ${child.class_name}` : "Class not set yet"}</p>
                      </div>
                      <span className="inline-flex w-fit items-center rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">
                        {weekdayLabel}
                      </span>
                    </div>

                    {!cid ? (
                      <p className="mt-3 text-sm app-muted">No class assigned yet.</p>
                    ) : classEntries.length === 0 ? (
                      <p className="mt-3 text-sm app-muted">No timetable set for this class on {weekdayLabel}.</p>
                    ) : (
                      <div className="mt-4 grid gap-2">
                        {classEntries.map((e) => (
                          <div
                            key={e.id}
                            className={`rounded-3xl border px-4 py-3 ${
                              e.is_therapy
                                ? "border-indigo-100 bg-indigo-50"
                                : "border-slate-200 bg-slate-50"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-semibold text-slate-900">{e.title}</p>
                              <span className="text-xs font-semibold text-slate-700">
                                {e.start_time.slice(0, 5)}–{e.end_time.slice(0, 5)}
                              </span>
                            </div>
                            <p className={`mt-1 text-xs font-semibold ${e.is_therapy ? "text-indigo-700" : "text-slate-600"}`}>
                              {e.is_therapy ? "Therapy / Special support" : "Class activity"}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
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

