-- Pulse App — Full Schema + RLS
-- Run this in your Supabase SQL editor

-- SETTINGS
CREATE TABLE IF NOT EXISTS settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  currency TEXT NOT NULL DEFAULT 'GBP',
  leave_allowance INTEGER NOT NULL DEFAULT 20,
  day_off TEXT NOT NULL DEFAULT 'Sunday',
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_self" ON settings USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ATTENDANCE
CREATE TABLE IF NOT EXISTS attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  clocked_in_at TIMESTAMPTZ,
  clocked_out_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('working', 'leave', 'day_off')),
  notes TEXT,
  UNIQUE(user_id, date)
);
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendance_self" ON attendance USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- INCOME ENTRIES
CREATE TABLE IF NOT EXISTS income_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL,
  salary_amount NUMERIC(12,2) DEFAULT 0,
  home_visits_amount NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, month, year)
);
ALTER TABLE income_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "income_self" ON income_entries USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- EXPENSES
CREATE TABLE IF NOT EXISTS expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  description TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('salary', 'home_visits')),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expenses_self" ON expenses USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- SAVING POTS
CREATE TABLE IF NOT EXISTS saving_pots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  target_amount NUMERIC(12,2) NOT NULL,
  current_amount NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE saving_pots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pots_self" ON saving_pots USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- POT TRANSACTIONS
CREATE TABLE IF NOT EXISTS pot_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pot_id UUID REFERENCES saving_pots(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('salary', 'home_visits')),
  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal')),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE pot_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pot_tx_self" ON pot_transactions USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- PATIENT VISITS
CREATE TABLE IF NOT EXISTS patient_visits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  UNIQUE(user_id, date)
);
ALTER TABLE patient_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "patients_self" ON patient_visits USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- CONTENT ITEMS
CREATE TABLE IF NOT EXISTS content_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  url TEXT NOT NULL,
  notes TEXT,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "content_self" ON content_items USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
