-- Run this in Supabase SQL Editor to add new features

-- 1. Add avatar_url to settings, make day_off optional
ALTER TABLE settings ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE settings ALTER COLUMN day_off DROP NOT NULL;
ALTER TABLE settings ALTER COLUMN day_off SET DEFAULT NULL;

-- 2. Add category to content_items, make url optional, add title
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'uncategorized';
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE content_items ALTER COLUMN url DROP NOT NULL;

-- 3. Calendar events table
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6C5DD3',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events_self" ON calendar_events
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Avatars storage bucket (run separately if this errors)
INSERT INTO storage.buckets (id, name, public)
  VALUES ('avatars', 'avatars', true)
  ON CONFLICT DO NOTHING;

CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "avatars_owner_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "avatars_owner_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
