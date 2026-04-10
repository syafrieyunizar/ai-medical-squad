-- SQL untuk membuat tabel soap_history di Supabase
-- Jalankan SQL ini di Supabase Dashboard > SQL Editor

CREATE TABLE IF NOT EXISTS soap_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_identity TEXT NOT NULL,
  final_soap TEXT NOT NULL,
  interpretation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE soap_history ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own history
CREATE POLICY "Users can view own history" ON soap_history
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert their own history
CREATE POLICY "Users can insert own history" ON soap_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own history
CREATE POLICY "Users can delete own history" ON soap_history
  FOR DELETE USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_soap_history_user_id ON soap_history(user_id);
CREATE INDEX IF NOT EXISTS idx_soap_history_created_at ON soap_history(created_at DESC);
