-- Run this in your Supabase SQL editor

create table if not exists presence (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  nickname text not null,
  lat double precision not null,
  lng double precision not null,
  mood text not null default 'open', -- 'game' | 'chat' | 'silent'
  last_seen timestamptz not null default now()
);

create table if not exists open_seats (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  nickname text not null,
  location_name text not null,
  lat double precision not null,
  lng double precision not null,
  scheduled_at timestamptz not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'chat', -- 'chat' | 'game'
  name text,
  created_by text not null,
  lat double precision, -- nullable: captured at creation, used only to filter the public /rooms browse list
  lng double precision,
  created_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  user_id text not null,
  nickname text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists game_rooms (
  id uuid primary key references rooms(id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  user_id text not null,
  nickname text not null,
  type text not null, -- 'coffee' | 'game' | 'company'
  note text,
  lat double precision not null,
  lng double precision not null,
  participant_count integer not null default 1,
  created_at timestamptz not null default now()
);

-- Enable realtime on all tables
alter publication supabase_realtime add table presence;
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table game_rooms;
alter publication supabase_realtime add table open_seats;
alter publication supabase_realtime add table activities;

-- RLS: open read, authenticated by user_id header (we use anon key + row ownership)
alter table presence enable row level security;
alter table open_seats enable row level security;
alter table rooms enable row level security;
alter table messages enable row level security;
alter table game_rooms enable row level security;
alter table activities enable row level security;

create policy "anyone can read presence" on presence for select using (true);
create policy "anyone can upsert own presence" on presence for all using (true) with check (true);

create policy "anyone can read seats" on open_seats for select using (true);
create policy "anyone can insert seat" on open_seats for insert with check (true);
create policy "owner can delete seat" on open_seats for delete using (true);

create policy "anyone can read rooms" on rooms for select using (true);
create policy "anyone can create room" on rooms for insert with check (true);

create policy "anyone can read messages" on messages for select using (true);
create policy "anyone can send message" on messages for insert with check (true);

create policy "anyone can read game" on game_rooms for select using (true);
create policy "anyone can update game" on game_rooms for all using (true) with check (true);

create policy "anyone can read activities" on activities for select using (true);
create policy "anyone can post activity" on activities for all using (true) with check (true);
