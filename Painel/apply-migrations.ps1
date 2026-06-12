$token = $env:SUPABASE_ACCESS_TOKEN
if (-not $token) { throw "Defina SUPABASE_ACCESS_TOKEN antes de executar este script." }
$h = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" }
$url = "https://api.supabase.com/v1/projects/zjwfymxknibxndaglyuo/database/query"
$base = Split-Path -Parent $MyInvocation.MyCommand.Path

function SendSql([string]$sql, [string]$label) {
    $b = @{ query = $sql } | ConvertTo-Json -Depth 3 -Compress
    try {
        $null = Invoke-RestMethod -Uri $url -Method POST -Headers $h -Body $b -ErrorAction Stop
        return $true
    } catch {
        $m = if ($_.ErrorDetails.Message) {
            try { ($_.ErrorDetails.Message | ConvertFrom-Json).message } catch { $_.ErrorDetails.Message }
        } else { $_.Exception.Message }
        Write-Host "  [ERR] $label -- $m" -ForegroundColor Red
        return $false
    }
}

function ApplyMigration([int]$fase) {
    $file = "$base\supabase-migration-fase$fase.sql"
    $raw = Get-Content $file -Raw

    # Parser simples: respeita blocos $$ (DO $$ ... END $$)
    $statements = [System.Collections.Generic.List[string]]::new()
    $buf = [System.Text.StringBuilder]::new()
    $inDollar = $false

    foreach ($line in ($raw -split "`n")) {
        # conta delimitadores $$ nesta linha (toggle)
        $ddCount = ([regex]::Matches($line, '\$\$')).Count
        if ($ddCount % 2 -eq 1) { $inDollar = -not $inDollar }

        $null = $buf.AppendLine($line)

        # Fim de statement: ponto-e-vírgula no final de linha, fora de bloco $$
        if (-not $inDollar -and $line.TrimEnd() -match ';\s*$') {
            $stmt = $buf.ToString().Trim()
            if ($stmt.Length -gt 3 -and $stmt -notmatch '^--') {
                $statements.Add($stmt)
            }
            $null = $buf.Clear()
        }
    }
    # conteúdo restante (sem ponto-e-vírgula final)
    $rest = $buf.ToString().Trim()
    if ($rest.Length -gt 3) { $statements.Add($rest) }

    $ok = 0
    $fail = 0
    foreach ($s in $statements) {
        $trimmed = $s.Trim()
        if ($trimmed.Length -lt 3 -or $trimmed -match '^--') { continue }
        if (SendSql $trimmed "f$fase") { $ok++ } else { $fail++ }
    }

    $color = if ($fail -eq 0) { 'Green' } else { 'Yellow' }
    $total = $statements.Count
    Write-Host "  Fase $fase concluida: $ok OK, $fail falhos / $total statements" -ForegroundColor $color
}

foreach ($f in @(3, 4, 5, 6, 7)) {
    Write-Host "==> Aplicando Fase $f..." -ForegroundColor Cyan
    ApplyMigration $f
}

Write-Host ""
Write-Host "Verificando tabelas criadas..." -ForegroundColor Cyan
$verifySql = "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('labels','conversation_label_map','quick_replies','media_attachments','sla_policies','automation_rules','automation_executions','inbox_alerts','dlq_events') ORDER BY table_name;"
$bv = @{ query = $verifySql } | ConvertTo-Json -Depth 3 -Compress
$r = Invoke-RestMethod -Uri $url -Method POST -Headers $h -Body $bv
$r | ForEach-Object { Write-Host "  OK -- $($_.table_name)" -ForegroundColor Green }
