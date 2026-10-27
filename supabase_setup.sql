-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- Creates the career_applications table and a storage bucket for resumes.

-- 1. Career applications table
create table if not exists career_applications (
  id            bigint generated always as identity primary key,
  full_name     text not null,
  college       text not null,
  branch        text not null,
  year          text not null,
  github        text,
  python_level  text not null,
  tools_used    text not null,
  messy_data_exp text not null,
  can_commit    text not null,
  project_link  text,
  why_this_role text not null,
  resume_url    text,
  role          text not null default 'Backend & Data Pipeline Intern',
  created_at    timestamptz not null default now()
);

-- 2. Enable Row Level Security and allow inserts from anon (public form)
alter table career_applications enable row level security;

create policy "Allow public inserts"
  on career_applications
  for insert
  to anon
  with check (true);

-- 3. Create storage bucket for resumes (public read so the URL works)
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', true)
on conflict (id) do nothing;

-- 4. Allow anon uploads into the resumes bucket
create policy "Allow public uploads"
  on storage.objects
  for insert
  to anon
  with check (bucket_id = 'resumes');
