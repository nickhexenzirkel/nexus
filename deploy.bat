@echo off
rename supabase\functions\server make-server-e9524f09
rename supabase\functions\make-server-e9524f09\index.tsx index.ts
rename supabase\functions\make-server-e9524f09\kv_store.tsx kv_store.ts
supabase functions deploy make-server-e9524f09 --use-api
rename supabase\functions\make-server-e9524f09\index.ts index.tsx
rename supabase\functions\make-server-e9524f09\kv_store.ts kv_store.tsx
rename supabase\functions\make-server-e9524f09 server
echo Deploy concluido!
pause