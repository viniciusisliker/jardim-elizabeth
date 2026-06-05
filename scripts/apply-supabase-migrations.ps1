# Aplica o sistema de territorios no Supabase remoto
# Pre-requisito: npx supabase login
# Uso: .\scripts\apply-supabase-migrations.ps1

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host "Projeto: prhijmkvsgqusivmnqzx" -ForegroundColor Cyan
npx supabase link --project-ref prhijmkvsgqusivmnqzx 2>$null

Write-Host "Aplicando SQL (idempotente)..." -ForegroundColor Cyan
npx supabase db query --linked -f "supabase/manual/apply_territory_system.sql"

Write-Host "Verificando tabelas..." -ForegroundColor Cyan
npx supabase db query --linked "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'territory%' ORDER BY 1;"

Write-Host "Concluido. Abra Hub > Territorios." -ForegroundColor Green
