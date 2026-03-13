import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabaseServerAdmin'

type CreateUserBody = {
  email: string
  fullName: string
  role: 'admin' | 'teacher' | 'therapist' | 'parent'
  tempPassword: string
  isSuperAdmin?: boolean
}

export async function POST(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin()

    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null

    if (!token) {
      return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
    }

    // Verify caller
    const supabaseAuthed = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const {
      data: { user: caller },
      error: callerError,
    } = await supabaseAuthed.auth.getUser()

    if (callerError || !caller) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check super admin flag from public.users (RLS will allow self-select)
    const { data: callerProfile, error: profileError } = await supabaseAuthed
      .from('users')
      .select('is_super_admin')
      .eq('id', caller.id)
      .maybeSingle()

    if (profileError || !callerProfile?.is_super_admin) {
      return NextResponse.json({ error: 'Forbidden (super admin only)' }, { status: 403 })
    }

    const body = (await req.json()) as CreateUserBody
    const email = body.email?.trim().toLowerCase()
    const fullName = body.fullName?.trim()
    const role = body.role
    const tempPassword = body.tempPassword
    const isSuperAdmin = body.isSuperAdmin === true

    if (!email || !fullName || !role || !tempPassword) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (tempPassword.length < 8) {
      return NextResponse.json({ error: 'Temporary password must be at least 8 characters' }, { status: 400 })
    }

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    })

    if (createError || !created.user) {
      return NextResponse.json({ error: createError?.message ?? 'Unable to create user' }, { status: 400 })
    }

    const userId = created.user.id

    // Set app_metadata for role / super admin
    const { error: metaError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      app_metadata: {
        role,
        is_super_admin: isSuperAdmin,
      },
    })

    if (metaError) {
      return NextResponse.json({ error: metaError.message }, { status: 400 })
    }

    // Upsert into public.users profile table
    const { error: upsertError } = await supabaseAdmin.from('users').upsert({
      id: userId,
      email,
      full_name: fullName,
      role,
      is_super_admin: isSuperAdmin,
    })

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 400 })
    }

    return NextResponse.json({ id: userId }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Unknown error' }, { status: 500 })
  }
}

