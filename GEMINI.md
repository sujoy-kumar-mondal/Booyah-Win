# Booyah Win project rules

- Follow BOOYAH_WIN_SPEC.md exactly. Use booyah_win_schema.sql as the database.
- Build only the milestone I name. Ask before changing the spec.
- Never read, print or create real secrets. Use .env.example with empty values.
- Money is NUMERIC in the database and integer paise in code, never floats.
- After each milestone, run the tests and show me the results.
- Development mode: print OTPs to the console, use local file storage.
- Tests must only run against TEST_DATABASE_URL, and must refuse to run if the
  database name does not end in "_test". Never run tests or migrations against
  a Supabase URL or any remote database.
- Never open, read, edit or print .env files. Only create and edit .env.example.
- Ask me before running any command that installs global packages, deletes
  files, downloads and runs scripts, or touches anything outside this project
  folder.
- Show a plan before large changes, and list every assumption at the end.