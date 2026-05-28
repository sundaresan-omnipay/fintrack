-- Run this in your Supabase SQL editor

CREATE TABLE loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Home Loan',
  original_principal decimal(15,2) NOT NULL,
  interest_rate decimal(6,3) NOT NULL,   -- annual %, e.g. 8.5
  tenure_months integer NOT NULL,
  start_date date NOT NULL,              -- date of first EMI
  emi_amount decimal(15,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own loans" ON loans FOR ALL USING (auth.uid() = user_id);
CREATE INDEX loans_user_id_idx ON loans(user_id);

CREATE TABLE loan_prepayments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount decimal(15,2) NOT NULL,
  date date NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE loan_prepayments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own prepayments" ON loan_prepayments FOR ALL USING (auth.uid() = user_id);
CREATE INDEX loan_prepayments_loan_id_idx ON loan_prepayments(loan_id);
