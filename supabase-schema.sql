-- Supabase schema for Step Ahead Inclusive MVP

-- 1) Users and roles
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text unique,
  role text check (role in ('admin', 'teacher', 'therapist', 'parent')),
  is_super_admin boolean not null default false,
  phone text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.users enable row level security;

-- If table already existed before adding is_super_admin, this ensures the column exists.
alter table public.users
add column if not exists is_super_admin boolean not null default false;

-- Helper: check super admin status without RLS recursion
create or replace function public.is_super_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce((select u.is_super_admin from public.users u where u.id = uid), false);
$$;

-- Minimal RLS policies (extend as you harden the app)
drop policy if exists "users_select_own" on public.users;
create policy "users_select_own"
on public.users
for select
to authenticated
using (id = auth.uid());

drop policy if exists "users_super_admin_all" on public.users;
create policy "users_super_admin_all"
on public.users
for all
to authenticated
using (public.is_super_admin(auth.uid()))
with check (public.is_super_admin(auth.uid()));

-- 2) Classes
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  grade_level text,
  room text,
  primary_teacher_id uuid references public.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.classes enable row level security;

drop policy if exists "classes_super_admin_all" on public.classes;
create policy "classes_super_admin_all"
on public.classes
for all
to authenticated
using (public.is_super_admin(auth.uid()))
with check (public.is_super_admin(auth.uid()));

-- Allow admin role (principal) to manage classes as well
drop policy if exists "classes_admin_all" on public.classes;
create policy "classes_admin_all"
on public.classes
for all
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  )
);

drop policy if exists "classes_teacher_select_assigned" on public.classes;
create policy "classes_teacher_select_assigned"
on public.classes
for select
to authenticated
using (primary_teacher_id = auth.uid());

-- 3) Students
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  photo_url text,
  date_of_birth date,
  gender text,
  class_id uuid references public.classes(id),
  diagnosis text,
  iep_summary text,
  accommodations jsonb,
  medical_notes text,
  admission_date date,
  status text default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.students enable row level security;

drop policy if exists "students_super_admin_all" on public.students;
create policy "students_super_admin_all"
on public.students
for all
to authenticated
using (public.is_super_admin(auth.uid()))
with check (public.is_super_admin(auth.uid()));

-- Allow admin role to manage students
drop policy if exists "students_admin_all" on public.students;
create policy "students_admin_all"
on public.students
for all
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  )
);

drop policy if exists "students_teacher_select_assigned_classes" on public.students;
create policy "students_teacher_select_assigned_classes"
on public.students
for select
to authenticated
using (
  exists (
    select 1
    from public.classes c
    where c.id = students.class_id
      and c.primary_teacher_id = auth.uid()
  )
);

-- 4) Parent-student relationships
create table if not exists public.parents_students (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.users(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  relationship text,
  created_at timestamptz default now(),
  unique (parent_id, student_id)
);

alter table public.parents_students enable row level security;

drop policy if exists "parents_students_super_admin_all" on public.parents_students;
create policy "parents_students_super_admin_all"
on public.parents_students
for all
to authenticated
using (public.is_super_admin(auth.uid()))
with check (public.is_super_admin(auth.uid()));

-- Allow admin role to manage parent ↔ student links
drop policy if exists "parents_students_admin_all" on public.parents_students;
create policy "parents_students_admin_all"
on public.parents_students
for all
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  )
);

drop policy if exists "parents_students_parent_select_own" on public.parents_students;
create policy "parents_students_parent_select_own"
on public.parents_students
for select
to authenticated
using (parent_id = auth.uid());

-- 5) Therapist-student relationships
create table if not exists public.therapist_students (
  id uuid primary key default gen_random_uuid(),
  therapist_id uuid not null references public.users(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  start_date date,
  end_date date,
  created_at timestamptz default now(),
  unique (therapist_id, student_id)
);

alter table public.therapist_students enable row level security;

drop policy if exists "therapist_students_super_admin_all" on public.therapist_students;
create policy "therapist_students_super_admin_all"
on public.therapist_students
for all
to authenticated
using (public.is_super_admin(auth.uid()))
with check (public.is_super_admin(auth.uid()));

-- Allow admin role to manage therapist ↔ student links
drop policy if exists "therapist_students_admin_all" on public.therapist_students;
create policy "therapist_students_admin_all"
on public.therapist_students
for all
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  )
);

drop policy if exists "therapist_students_therapist_select_own" on public.therapist_students;
create policy "therapist_students_therapist_select_own"
on public.therapist_students
for select
to authenticated
using (therapist_id = auth.uid());

-- 6) Attendance
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  date date not null,
  status text not null check (status in ('present', 'absent', 'late', 'therapy')),
  note text,
  marked_by uuid references public.users(id),
  created_at timestamptz default now(),
  unique (student_id, class_id, date)
);

alter table public.attendance enable row level security;

drop policy if exists "attendance_super_admin_all" on public.attendance;
create policy "attendance_super_admin_all"
on public.attendance
for all
to authenticated
using (public.is_super_admin(auth.uid()))
with check (public.is_super_admin(auth.uid()));

-- Allow admin role to view and manage attendance
drop policy if exists "attendance_admin_all" on public.attendance;
create policy "attendance_admin_all"
on public.attendance
for all
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  )
);

drop policy if exists "attendance_teacher_select_assigned_classes" on public.attendance;
create policy "attendance_teacher_select_assigned_classes"
on public.attendance
for select
to authenticated
using (
  exists (
    select 1
    from public.classes c
    where c.id = attendance.class_id
      and c.primary_teacher_id = auth.uid()
  )
);

drop policy if exists "attendance_teacher_insert_assigned_classes" on public.attendance;
create policy "attendance_teacher_insert_assigned_classes"
on public.attendance
for insert
to authenticated
with check (
  exists (
    select 1
    from public.classes c
    where c.id = attendance.class_id
      and c.primary_teacher_id = auth.uid()
  )
);

-- 6a. Timetable entries (visual schedule by class and day)
create table if not exists public.class_timetable_entries (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6), -- 0 = Sunday, 6 = Saturday
  start_time time not null,
  end_time time not null,
  title text not null,
  is_therapy boolean not null default false,
  created_by uuid references public.users(id),
  created_at timestamptz default now()
);

alter table public.class_timetable_entries enable row level security;

-- Super admin full control
drop policy if exists "class_timetable_super_admin_all" on public.class_timetable_entries;
create policy "class_timetable_super_admin_all"
on public.class_timetable_entries
for all
to authenticated
using (public.is_super_admin(auth.uid()))
with check (public.is_super_admin(auth.uid()));

-- Admins manage all timetable entries
drop policy if exists "class_timetable_admin_all" on public.class_timetable_entries;
create policy "class_timetable_admin_all"
on public.class_timetable_entries
for all
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  )
);

-- Teachers can view timetable for their own classes
drop policy if exists "class_timetable_teacher_select_assigned_classes" on public.class_timetable_entries;
create policy "class_timetable_teacher_select_assigned_classes"
on public.class_timetable_entries
for select
to authenticated
using (
  exists (
    select 1
    from public.classes c
    where c.id = class_timetable_entries.class_id
      and c.primary_teacher_id = auth.uid()
  )
);

-- Parents can view timetable for their child's class
drop policy if exists "class_timetable_parent_select_child_classes" on public.class_timetable_entries;
create policy "class_timetable_parent_select_child_classes"
on public.class_timetable_entries
for select
to authenticated
using (
  exists (
    select 1
    from public.parents_students ps
    join public.students s on s.id = ps.student_id
    where ps.parent_id = auth.uid()
      and s.class_id = class_timetable_entries.class_id
  )
);

-- Therapists can view timetable for classes where they have students
drop policy if exists "class_timetable_therapist_select_caseload_classes" on public.class_timetable_entries;
create policy "class_timetable_therapist_select_caseload_classes"
on public.class_timetable_entries
for select
to authenticated
using (
  exists (
    select 1
    from public.therapist_students ts
    join public.students s on s.id = ts.student_id
    where ts.therapist_id = auth.uid()
      and s.class_id = class_timetable_entries.class_id
  )
);

-- 6b) Leave requests (parents request, admin approves; ties into attendance)
create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  requested_by_parent_id uuid not null references public.users(id) on delete cascade,
  date_from date not null,
  date_to date not null,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_by uuid references public.users(id),
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz default now()
);

alter table public.leave_requests enable row level security;

drop policy if exists "leave_requests_super_admin_all" on public.leave_requests;
create policy "leave_requests_super_admin_all"
on public.leave_requests
for all
to authenticated
using (public.is_super_admin(auth.uid()))
with check (public.is_super_admin(auth.uid()));

-- Allow admin role to manage leave requests
drop policy if exists "leave_requests_admin_all" on public.leave_requests;
create policy "leave_requests_admin_all"
on public.leave_requests
for all
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  )
);

drop policy if exists "leave_requests_parent_select_own_children" on public.leave_requests;
create policy "leave_requests_parent_select_own_children"
on public.leave_requests
for select
to authenticated
using (
  requested_by_parent_id = auth.uid()
  and exists (
    select 1
    from public.parents_students ps
    where ps.student_id = leave_requests.student_id
      and ps.parent_id = auth.uid()
  )
);

drop policy if exists "leave_requests_parent_insert_own_children" on public.leave_requests;
create policy "leave_requests_parent_insert_own_children"
on public.leave_requests
for insert
to authenticated
with check (
  requested_by_parent_id = auth.uid()
  and exists (
    select 1
    from public.parents_students ps
    where ps.student_id = leave_requests.student_id
      and ps.parent_id = auth.uid()
  )
);

drop policy if exists "leave_requests_teacher_select_assigned_classes" on public.leave_requests;
create policy "leave_requests_teacher_select_assigned_classes"
on public.leave_requests
for select
to authenticated
using (
  exists (
    select 1
    from public.students s
    join public.classes c on c.id = s.class_id
    where s.id = leave_requests.student_id
      and c.primary_teacher_id = auth.uid()
  )
);

-- 7) Homework
create table if not exists public.homework (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  title text not null,
  description text,
  due_date date,
  attachment_url text,
  created_by uuid references public.users(id),
  created_at timestamptz default now()
);

alter table public.homework enable row level security;

drop policy if exists "homework_super_admin_all" on public.homework;
create policy "homework_super_admin_all"
on public.homework
for all
to authenticated
using (public.is_super_admin(auth.uid()))
with check (public.is_super_admin(auth.uid()));

-- Allow admin role to view/manage homework if needed
drop policy if exists "homework_admin_all" on public.homework;
create policy "homework_admin_all"
on public.homework
for all
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  )
);

drop policy if exists "homework_teacher_select_assigned_classes" on public.homework;
create policy "homework_teacher_select_assigned_classes"
on public.homework
for select
to authenticated
using (
  exists (
    select 1
    from public.classes c
    where c.id = homework.class_id
      and c.primary_teacher_id = auth.uid()
  )
);

drop policy if exists "homework_teacher_insert_assigned_classes" on public.homework;
create policy "homework_teacher_insert_assigned_classes"
on public.homework
for insert
to authenticated
with check (
  exists (
    select 1
    from public.classes c
    where c.id = homework.class_id
      and c.primary_teacher_id = auth.uid()
  )
);

-- 8) IEP goals
create table if not exists public.iep_goals (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  area text not null,
  goal_description text not null,
  start_date date,
  target_date date,
  target_value numeric,
  status text default 'active',
  created_by uuid references public.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.iep_goals enable row level security;

drop policy if exists "iep_goals_super_admin_all" on public.iep_goals;
create policy "iep_goals_super_admin_all"
on public.iep_goals
for all
to authenticated
using (public.is_super_admin(auth.uid()))
with check (public.is_super_admin(auth.uid()));

-- Allow admin role to view/manage IEP goals
drop policy if exists "iep_goals_admin_all" on public.iep_goals;
create policy "iep_goals_admin_all"
on public.iep_goals
for all
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  )
);

drop policy if exists "iep_goals_therapist_select_assigned_students" on public.iep_goals;
create policy "iep_goals_therapist_select_assigned_students"
on public.iep_goals
for select
to authenticated
using (
  exists (
    select 1
    from public.therapist_students ts
    where ts.student_id = iep_goals.student_id
      and ts.therapist_id = auth.uid()
  )
);

-- 9) IEP progress entries
create table if not exists public.iep_progress_entries (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.iep_goals(id) on delete cascade,
  date date not null,
  progress_pct numeric check (progress_pct >= 0 and progress_pct <= 100),
  metric_value numeric,
  note text,
  logged_by uuid references public.users(id),
  created_at timestamptz default now()
);

alter table public.iep_progress_entries enable row level security;

drop policy if exists "iep_progress_super_admin_all" on public.iep_progress_entries;
create policy "iep_progress_super_admin_all"
on public.iep_progress_entries
for all
to authenticated
using (public.is_super_admin(auth.uid()))
with check (public.is_super_admin(auth.uid()));

-- Allow admin role to view/manage IEP progress
drop policy if exists "iep_progress_admin_all" on public.iep_progress_entries;
create policy "iep_progress_admin_all"
on public.iep_progress_entries
for all
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  )
);

drop policy if exists "iep_progress_therapist_select_assigned" on public.iep_progress_entries;
create policy "iep_progress_therapist_select_assigned"
on public.iep_progress_entries
for select
to authenticated
using (
  exists (
    select 1
    from public.iep_goals g
    join public.therapist_students ts on ts.student_id = g.student_id
    where g.id = iep_progress_entries.goal_id
      and ts.therapist_id = auth.uid()
  )
);

-- 10) Behavior logs
create table if not exists public.behavior_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  date_time timestamptz not null,
  behavior_type text,
  antecedent text,
  behavior text,
  consequence text,
  intensity text,
  duration_minutes numeric,
  logged_by uuid references public.users(id),
  created_at timestamptz default now()
);

alter table public.behavior_logs enable row level security;

drop policy if exists "behavior_logs_super_admin_all" on public.behavior_logs;
create policy "behavior_logs_super_admin_all"
on public.behavior_logs
for all
to authenticated
using (public.is_super_admin(auth.uid()))
with check (public.is_super_admin(auth.uid()));

-- Allow admin role to view/manage behavior logs
drop policy if exists "behavior_logs_admin_all" on public.behavior_logs;
create policy "behavior_logs_admin_all"
on public.behavior_logs
for all
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  )
);

drop policy if exists "behavior_logs_therapist_select_assigned" on public.behavior_logs;
create policy "behavior_logs_therapist_select_assigned"
on public.behavior_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.therapist_students ts
    where ts.student_id = behavior_logs.student_id
      and ts.therapist_id = auth.uid()
  )
);

-- 11) Sensory profiles
create table if not exists public.sensory_profiles (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null unique references public.students(id) on delete cascade,
  summary text,
  sensory_needs jsonb,
  recommended_strategies text,
  updated_by uuid references public.users(id),
  updated_at timestamptz default now()
);

alter table public.sensory_profiles enable row level security;

drop policy if exists "sensory_profiles_super_admin_all" on public.sensory_profiles;
create policy "sensory_profiles_super_admin_all"
on public.sensory_profiles
for all
to authenticated
using (public.is_super_admin(auth.uid()))
with check (public.is_super_admin(auth.uid()));

-- Allow admin role to view/manage sensory profiles
drop policy if exists "sensory_profiles_admin_all" on public.sensory_profiles;
create policy "sensory_profiles_admin_all"
on public.sensory_profiles
for all
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  )
);

drop policy if exists "sensory_profiles_therapist_select_assigned" on public.sensory_profiles;
create policy "sensory_profiles_therapist_select_assigned"
on public.sensory_profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.therapist_students ts
    where ts.student_id = sensory_profiles.student_id
      and ts.therapist_id = auth.uid()
  )
);

-- 12) Therapy sessions
create table if not exists public.therapy_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  therapist_id uuid not null references public.users(id),
  session_date date not null,
  therapy_type text,
  duration_minutes numeric,
  activities text,
  outcomes text,
  linked_goal_ids uuid[] default '{}',
  created_at timestamptz default now()
);

alter table public.therapy_sessions enable row level security;

drop policy if exists "therapy_sessions_super_admin_all" on public.therapy_sessions;
create policy "therapy_sessions_super_admin_all"
on public.therapy_sessions
for all
to authenticated
using (public.is_super_admin(auth.uid()))
with check (public.is_super_admin(auth.uid()));

-- Allow admin role to view/manage therapy sessions
drop policy if exists "therapy_sessions_admin_all" on public.therapy_sessions;
create policy "therapy_sessions_admin_all"
on public.therapy_sessions
for all
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  )
);

drop policy if exists "therapy_sessions_therapist_select_own" on public.therapy_sessions;
create policy "therapy_sessions_therapist_select_own"
on public.therapy_sessions
for select
to authenticated
using (therapist_id = auth.uid());

drop policy if exists "therapy_sessions_therapist_insert_own" on public.therapy_sessions;
create policy "therapy_sessions_therapist_insert_own"
on public.therapy_sessions
for insert
to authenticated
with check (therapist_id = auth.uid());

-- 13) Portfolio items
create table if not exists public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  type text not null,
  title text not null,
  description text,
  file_url text,
  thumbnail_url text,
  source text default 'school',
  created_by uuid references public.users(id),
  created_by_role text,
  is_visible_to_parent boolean default true,
  requires_approval boolean default false,
  approved boolean default true,
  approved_by uuid references public.users(id),
  created_at timestamptz default now()
);

alter table public.portfolio_items enable row level security;

drop policy if exists "portfolio_items_super_admin_all" on public.portfolio_items;
create policy "portfolio_items_super_admin_all"
on public.portfolio_items
for all
to authenticated
using (public.is_super_admin(auth.uid()))
with check (public.is_super_admin(auth.uid()));

-- Allow admin role to view/manage portfolio items
drop policy if exists "portfolio_items_admin_all" on public.portfolio_items;
create policy "portfolio_items_admin_all"
on public.portfolio_items
for all
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  )
);

drop policy if exists "portfolio_items_teacher_select_assigned" on public.portfolio_items;
create policy "portfolio_items_teacher_select_assigned"
on public.portfolio_items
for select
to authenticated
using (
  exists (
    select 1
    from public.students s
    join public.classes c on c.id = s.class_id
    where s.id = portfolio_items.student_id
      and c.primary_teacher_id = auth.uid()
  )
);

drop policy if exists "portfolio_items_teacher_insert_assigned" on public.portfolio_items;
create policy "portfolio_items_teacher_insert_assigned"
on public.portfolio_items
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.students s
    join public.classes c on c.id = s.class_id
    where s.id = portfolio_items.student_id
      and c.primary_teacher_id = auth.uid()
  )
);

drop policy if exists "portfolio_items_therapist_select_assigned" on public.portfolio_items;
create policy "portfolio_items_therapist_select_assigned"
on public.portfolio_items
for select
to authenticated
using (
  exists (
    select 1
    from public.therapist_students ts
    where ts.student_id = portfolio_items.student_id
      and ts.therapist_id = auth.uid()
  )
);

drop policy if exists "portfolio_items_therapist_insert_assigned" on public.portfolio_items;
create policy "portfolio_items_therapist_insert_assigned"
on public.portfolio_items
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.therapist_students ts
    where ts.student_id = portfolio_items.student_id
      and ts.therapist_id = auth.uid()
  )
);

drop policy if exists "portfolio_items_parent_select_own_children" on public.portfolio_items;
create policy "portfolio_items_parent_select_own_children"
on public.portfolio_items
for select
to authenticated
using (
  is_visible_to_parent = true
  and exists (
    select 1
    from public.parents_students ps
    where ps.student_id = portfolio_items.student_id
      and ps.parent_id = auth.uid()
  )
);

-- 14) Recommendations
create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  area text,
  title text not null,
  description text,
  created_by uuid references public.users(id),
  created_by_role text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.recommendations enable row level security;

drop policy if exists "recommendations_super_admin_all" on public.recommendations;
create policy "recommendations_super_admin_all"
on public.recommendations
for all
to authenticated
using (public.is_super_admin(auth.uid()))
with check (public.is_super_admin(auth.uid()));

-- Allow admin role to view/manage recommendations
drop policy if exists "recommendations_admin_all" on public.recommendations;
create policy "recommendations_admin_all"
on public.recommendations
for all
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  )
);

drop policy if exists "recommendations_parent_select_own_children" on public.recommendations;
create policy "recommendations_parent_select_own_children"
on public.recommendations
for select
to authenticated
using (
  exists (
    select 1
    from public.parents_students ps
    where ps.student_id = recommendations.student_id
      and ps.parent_id = auth.uid()
  )
);

-- 15) Fees
create table if not exists public.fees (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  period text not null,
  fee_type text,
  amount_due numeric not null,
  amount_paid numeric default 0,
  due_date date,
  status text default 'unpaid',
  last_payment_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.fees enable row level security;

-- If table already existed before adding fee_type, ensure the column exists.
alter table public.fees
add column if not exists fee_type text;

drop policy if exists "fees_super_admin_all" on public.fees;
create policy "fees_super_admin_all"
on public.fees
for all
to authenticated
using (public.is_super_admin(auth.uid()))
with check (public.is_super_admin(auth.uid()));

-- Allow admin role to manage all fees
drop policy if exists "fees_admin_all" on public.fees;
create policy "fees_admin_all"
on public.fees
for all
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  )
);

drop policy if exists "fees_parent_select_own_children" on public.fees;
create policy "fees_parent_select_own_children"
on public.fees
for select
to authenticated
using (
  exists (
    select 1
    from public.parents_students ps
    where ps.student_id = fees.student_id
      and ps.parent_id = auth.uid()
  )
);

-- One-time seed example for Sadia (run in Supabase SQL editor after she exists in auth.users + public.users)
-- update public.users set role='admin', is_super_admin=true where email='sadia@stepahead.com';

-- =====================================================================
-- Supabase Storage (Portfolio uploads) - run in Supabase SQL editor
-- =====================================================================
-- Required:
-- 1) Create a bucket named: portfolio
-- 2) Decide if objects are public or private.
--
-- Option A (simple): public bucket
-- - Teachers/therapists upload from the browser and we store a public URL in public.portfolio_items.file_url
-- - Parents can open the link without signed URLs
--
-- Option B (more secure): private bucket + signed URLs
-- - Then you should store object path (not public URL) and serve signed URLs from a server route.
--
-- The app currently uses public URLs (Option A). Recommended policies:
--
-- -- Allow authenticated users to upload into the portfolio bucket
-- -- (RLS on public.portfolio_items still controls which DB rows they can create)
-- create policy "portfolio_upload_authenticated"
-- on storage.objects
-- for insert
-- to authenticated
-- with check (
--   bucket_id = 'portfolio'
-- );
--
-- -- Allow authenticated users to read portfolio objects
-- -- (If you keep the bucket public, this isn't necessary.)
-- create policy "portfolio_read_authenticated"
-- on storage.objects
-- for select
-- to authenticated
-- using (
--   bucket_id = 'portfolio'
-- );

