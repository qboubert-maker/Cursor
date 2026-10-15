-- Blank Delay affiliate ledger.
-- The running site stores the same records in data/affiliates.json.
-- Point the service at PostgreSQL or Supabase with this schema when a hosted database is ready.

create table if not exists affiliate_users (
  id text primary key,
  email text not null unique,
  name text not null,
  password_hash text not null,
  password_salt text not null,
  created_at timestamptz not null default now()
);

create table if not exists affiliate_links (
  id text primary key,
  user_id text not null unique references affiliate_users (id),
  slug text not null unique,
  click_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists affiliate_click_guards (
  id text primary key,
  link_id text not null references affiliate_links (id),
  ip_hash text not null,
  visitor_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists affiliate_click_guards_recent
  on affiliate_click_guards (link_id, created_at desc);

create table if not exists affiliate_sales (
  id text primary key,
  order_id text not null unique,
  user_id text not null references affiliate_users (id),
  link_id text not null references affiliate_links (id),
  product_id text not null,
  total_cents integer not null,
  commission_cents integer not null,
  created_at timestamptz not null default now()
);

create table if not exists affiliate_payouts (
  id text primary key,
  user_id text not null references affiliate_users (id),
  amount_cents integer not null,
  status text not null check (status in ('pending', 'paid')),
  created_at timestamptz not null default now()
);
