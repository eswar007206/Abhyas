# Deprecated Edge Functions

These Supabase Edge Functions are **deprecated**. Use the Abhyas backend API instead:

| Edge function                   | Backend replacement                                |
| ------------------------------- | -------------------------------------------------- |
| `developer-create-organization` | `POST /api/organizations`                          |
| `create-org-student`            | `POST /api/org/students`                           |
| `reset-org-student-password`    | `POST /api/org/students/:studentId/reset-password` |

The frontend already calls the backend via `frontend/src/lib/api.ts`.

Do not deploy or extend these functions for new work. They remain only for backwards compatibility during migration.
