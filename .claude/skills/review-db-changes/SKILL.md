---
description: Review pending SQL migrations and DB-related file changes before applying them. Use when asking about migrations, database changes, seed files, or before running "npm run migrate".
allowed-tools: Bash(node database/migrate-status.js) Bash(git diff -- database/) Bash(git status -- database/) Glob Read
---

## Migration status

!`cd d:\Sujit\AiML\AITech\academy\beangali-board\bengaliMath\database && node migrate-status.js 2>&1 || echo "Could not run migrate-status.js"`

## Pending SQL files (untracked / modified)

!`git -C d:\Sujit\AiML\AITech\academy\beangali-board\bengaliMath status --short -- database/`

## Diff of database directory changes

!`git -C d:\Sujit\AiML\AITech\academy\beangali-board\bengaliMath diff -- database/`

## Instructions

You are reviewing database changes for a Bengali math tutoring app (SQLite, better-sqlite3).

1. **Migration status** — list which migrations are applied vs pending from the output above.
2. **Review each pending/modified SQL file** and check for:
   - Destructive operations: `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, `DELETE` without WHERE
   - Missing `IF NOT EXISTS` / `IF EXISTS` guards on CREATE/DROP
   - Foreign key consistency — new tables referencing columns that exist in the schema
   - Index coverage — large tables without indexes on filter/join columns
   - Data-loss risk in seed files (e.g., `DELETE FROM` before insert)
   - Any hardcoded IDs that could break on a fresh DB
3. **Output format:**
   - One section per file reviewed
   - Bullet list of risks (label each: CRITICAL / WARNING / INFO)
   - A final "Safe to apply?" verdict: YES / NO / REVIEW FIRST
4. If no changes are found, say so clearly and suggest checking `npm run migrate:status`.
