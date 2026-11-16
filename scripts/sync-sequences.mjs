/**
 * Build step before migrations (v1.8.4): make sure the migrations table's id counter is ahead of its rows.
 * A database copied or restored by hand can leave the counter behind, and the next migration then fails to record
 * itself ("The following field is invalid: id"). Only moves the counter forward, never changes a row.
 */
import pg from 'pg'

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL
if (!url) process.exit(0)
const client = new pg.Client({ connectionString: url })
try {
  await client.connect()
  const t = await client.query(`SELECT to_regclass('public.payload_migrations') AS t, to_regclass('public.payload_migrations_id_seq') AS s`)
  if (t.rows[0].t && t.rows[0].s) {
    const r = await client.query(`SELECT setval('payload_migrations_id_seq', GREATEST((SELECT coalesce(max(id), 0) FROM payload_migrations), (SELECT last_value FROM payload_migrations_id_seq), 1)) AS v`)
    console.log(`> migrations counter at ${r.rows[0].v}`)
  }
} catch (err) {
  console.log(`> could not check the migrations counter (${err.message}); carrying on`)
} finally {
  await client.end().catch(() => {})
}
