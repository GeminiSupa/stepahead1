import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabaseServerAdmin'

type DecideBody = {
  leaveRequestId: string
  decision: 'approved' | 'rejected'
  decisionNote?: string
}

function dateRangeInclusive(fromISO: string, toISO: string) {
  const out: string[] = []
  const from = new Date(fromISO + 'T00:00:00Z')
  const to = new Date(toISO + 'T00:00:00Z')
  for (let d = new Date(from); d <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null
    if (!token) return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 })

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
    }

    const supabaseAuthed = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const {
      data: { user: caller },
      error: callerError,
    } = await supabaseAuthed.auth.getUser()
    if (callerError || !caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Super admin check (RLS allows self-select)
    const { data: callerProfile, error: profileError } = await supabaseAuthed
      .from('users')
      .select('is_super_admin')
      .eq('id', caller.id)
      .maybeSingle()
    if (profileError || !callerProfile?.is_super_admin) {
      return NextResponse.json({ error: 'Forbidden (super admin only)' }, { status: 403 })
    }

    const body = (await req.json()) as DecideBody
    if (!body.leaveRequestId || !body.decision) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    const { data: lr, error: lrError } = await supabaseAdmin
      .from('leave_requests')
      .select('id, student_id, date_from, date_to, status')
      .eq('id', body.leaveRequestId)
      .maybeSingle()

    if (lrError || !lr) return NextResponse.json({ error: lrError?.message ?? 'Not found' }, { status: 404 })
    if (lr.status !== 'pending') {
      return NextResponse.json({ error: 'This request is already decided.' }, { status: 400 })
    }

    const { data: student, error: studentError } = await supabaseAdmin
      .from('students')
      .select('id, class_id')
      .eq('id', lr.student_id)
      .maybeSingle()

    if (studentError || !student?.class_id) {
      return NextResponse.json({ error: studentError?.message ?? 'Student class not found' }, { status: 400 })
    }

    // Decide leave request
    const { error: updateError } = await supabaseAdmin
      .from('leave_requests')
      .update({
        status: body.decision,
        decided_by: caller.id,
        decided_at: new Date().toISOString(),
        decision_note: body.decisionNote ?? null,
      })
      .eq('id', lr.id)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })

    // Tie into attendance by creating rows as Absent with "Approved leave" note
    if (body.decision === 'approved') {
      const days = dateRangeInclusive(lr.date_from, lr.date_to)
      const rows = days.map((day) => ({
        student_id: lr.student_id,
        class_id: student.class_id,
        date: day,
        status: 'absent',
        note: 'Approved leave',
        marked_by: caller.id,
      }))

      const { error: attendanceError } = await supabaseAdmin.from('attendance').upsert(rows, {
        onConflict: 'student_id,class_id,date',
      })

      if (attendanceError) {
        return NextResponse.json({ error: attendanceError.message }, { status: 400 })
      }
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Unknown error' }, { status: 500 })
  }
}

