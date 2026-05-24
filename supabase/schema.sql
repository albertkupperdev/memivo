create table documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  source_type text check (source_type in ('pdf', 'url')) not null,
  source_url text,
  created_at timestamptz default now() not null
);

create table chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade not null,
  content text not null,
  chunk_index integer not null
);

create table cards (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade not null,
  chunk_id uuid references chunks(id) on delete cascade not null,
  front text not null,
  back text not null,
  created_at timestamptz default now() not null
);

create table card_reviews (
  id uuid primary key default gen_random_uuid(),
  card_id uuid references cards(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  ease_factor numeric default 2.5 not null,
  interval_days numeric default 1 not null,
  repetitions integer default 0 not null,
  due_date timestamptz default now() not null,
  last_reviewed_at timestamptz,
  unique(card_id, user_id)
);

alter table documents enable row level security;
alter table chunks enable row level security;
alter table cards enable row level security;
alter table card_reviews enable row level security;

create policy "users can select own documents"
  on documents for select using (auth.uid() = user_id);
create policy "users can insert own documents"
  on documents for insert with check (auth.uid() = user_id);
create policy "users can delete own documents"
  on documents for delete using (auth.uid() = user_id);

create policy "users can select own chunks"
  on chunks for select using (
    exists (select 1 from documents where documents.id = chunks.document_id and documents.user_id = auth.uid())
  );
create policy "users can insert own chunks"
  on chunks for insert with check (
    exists (select 1 from documents where documents.id = chunks.document_id and documents.user_id = auth.uid())
  );

create policy "users can select own cards"
  on cards for select using (
    exists (select 1 from documents where documents.id = cards.document_id and documents.user_id = auth.uid())
  );
create policy "users can insert own cards"
  on cards for insert with check (
    exists (select 1 from documents where documents.id = cards.document_id and documents.user_id = auth.uid())
  );

create policy "users can select own reviews"
  on card_reviews for select using (auth.uid() = user_id);
create policy "users can insert own reviews"
  on card_reviews for insert with check (auth.uid() = user_id);
create policy "users can update own reviews"
  on card_reviews for update using (auth.uid() = user_id);
