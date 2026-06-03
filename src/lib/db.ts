import postgres from "postgres";

// Direct PostgreSQL connection — bypasses PostgREST entirely.
// Used for migrations only (creating tables, granting access).
let _sql: ReturnType<typeof postgres> | null = null;

function getSQL() {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL not set");
    _sql = postgres(url, {
      ssl: { rejectUnauthorized: false },
      max: 1,
      idle_timeout: 15,
      connect_timeout: 10,
    });
  }
  return _sql;
}

export async function ensureFeatureTables(): Promise<void> {
  const sql = getSQL();

  await sql`
    CREATE TABLE IF NOT EXISTS incomes (
      id         uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    uuid          NOT NULL,
      amount     decimal(12,2) NOT NULL,
      source     text          NOT NULL DEFAULT 'Salary',
      month      text          NOT NULL,
      created_at timestamptz   NOT NULL DEFAULT now()
    )
  `;
  await sql`GRANT ALL ON TABLE incomes TO anon`;
  await sql`GRANT ALL ON TABLE incomes TO authenticated`;
  await sql`GRANT ALL ON TABLE incomes TO service_role`;

  await sql`
    CREATE TABLE IF NOT EXISTS savings (
      id                   uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id              uuid          NOT NULL,
      name                 text          NOT NULL,
      type                 text          NOT NULL DEFAULT 'sip'
                             CHECK (type IN ('sip','lumpsum','fd','ppf','nps','other')),
      monthly_amount       decimal(12,2) NOT NULL,
      start_date           date          NOT NULL DEFAULT CURRENT_DATE,
      expected_return_rate decimal(5,2)  NOT NULL DEFAULT 12.0,
      is_active            boolean       NOT NULL DEFAULT true,
      notes                text,
      created_at           timestamptz   NOT NULL DEFAULT now()
    )
  `;
  await sql`GRANT ALL ON TABLE savings TO anon`;
  await sql`GRANT ALL ON TABLE savings TO authenticated`;
  await sql`GRANT ALL ON TABLE savings TO service_role`;

  await sql`
    CREATE TABLE IF NOT EXISTS recurring_transactions (
      id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id      uuid          NOT NULL,
      description  text          NOT NULL,
      amount       decimal(12,2) NOT NULL,
      category     text          NOT NULL,
      day_of_month int           NOT NULL CHECK (day_of_month BETWEEN 1 AND 28),
      is_active    boolean       NOT NULL DEFAULT true,
      notes        text,
      created_at   timestamptz   NOT NULL DEFAULT now()
    )
  `;
  await sql`GRANT ALL ON TABLE recurring_transactions TO anon`;
  await sql`GRANT ALL ON TABLE recurring_transactions TO authenticated`;
  await sql`GRANT ALL ON TABLE recurring_transactions TO service_role`;

  await sql`
    CREATE TABLE IF NOT EXISTS goals (
      id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id        uuid          NOT NULL,
      name           text          NOT NULL,
      target_amount  decimal(12,2) NOT NULL,
      current_amount decimal(12,2) NOT NULL DEFAULT 0,
      target_date    date,
      category       text          NOT NULL DEFAULT 'other',
      icon           text          NOT NULL DEFAULT '🎯',
      color          text          NOT NULL DEFAULT '#7c3aed',
      notes          text,
      is_completed   boolean       NOT NULL DEFAULT false,
      created_at     timestamptz   NOT NULL DEFAULT now()
    )
  `;
  await sql`GRANT ALL ON TABLE goals TO anon`;
  await sql`GRANT ALL ON TABLE goals TO authenticated`;
  await sql`GRANT ALL ON TABLE goals TO service_role`;

  // Reload PostgREST schema cache
  await sql`SELECT pg_notify('pgrst', 'reload schema')`;
}
