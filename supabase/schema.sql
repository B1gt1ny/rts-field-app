create table if not exists public.jobs (
  job_id text primary key,
  status text not null,
  source text not null,
  assigned_crew text not null,
  priority text not null,
  due_date date,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jobs_status_idx on public.jobs (status);
create index if not exists jobs_source_idx on public.jobs (source);
create index if not exists jobs_crew_idx on public.jobs (assigned_crew);
create index if not exists jobs_due_date_idx on public.jobs (due_date);

alter table public.jobs enable row level security;

create table if not exists public.employees (
  id text primary key,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists employees_active_idx on public.employees (active);
alter table public.employees enable row level security;

insert into public.employees (id, name, active)
values ('ronnie', 'Ronnie', true)
on conflict (id) do nothing;

create table if not exists public.business_settings (
  business_id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.business_settings enable row level security;

insert into public.business_settings (business_id, data)
values (
  'rts',
  '{
    "businessId": "rts",
    "appDisplayName": "Company Command",
    "headerName": "Company Command — RTS",
    "brandShortName": "CC",
    "companyName": "RTS Field App",
    "phone": "",
    "email": "Texastrimout@gmail.com",
    "address": "",
    "city": "",
    "defaultCalendar": "Google Calendar",
    "defaultState": "TX",
    "merchandiseLink": "",
    "jobTypeOptions": ["Trim out", "Service", "Warranty", "Setup", "Skirting", "Repair"],
    "statusOptions": ["New", "Scheduled", "In Progress", "Waiting on Parts", "Needs Inspection", "Complete", "Billed", "Paid"],
    "priorityOptions": ["Low", "Normal", "High", "Urgent"],
    "checklistOptions": ["Paperwork picked up", "Scope reviewed", "Materials checked", "Before photos taken", "Serial/VIN tag photo taken", "Work completed", "After photos taken", "Completion notes added", "Customer/source notified", "Invoice created"],
    "requireAfterPhotosToComplete": true
  }'::jsonb
)
on conflict (business_id) do nothing;

create table if not exists public.merch_requests (
  id text primary key,
  business_id text not null default 'rts',
  status text not null default 'Requested',
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists merch_requests_business_idx on public.merch_requests (business_id);
create index if not exists merch_requests_status_idx on public.merch_requests (status);
alter table public.merch_requests enable row level security;

grant usage on schema public to service_role;
grant select, insert, update, delete on table public.jobs to service_role;
grant select, insert, update, delete on table public.employees to service_role;
grant select, insert, update, delete on table public.business_settings to service_role;
grant select, insert, update, delete on table public.merch_requests to service_role;

-- No browser-facing policy is intentionally created. The Next.js API uses the
-- server-only service role key. Add user-scoped policies when authentication ships.
