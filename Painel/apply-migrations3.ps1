$token = $env:SUPABASE_ACCESS_TOKEN
if (-not $token) { throw "Defina SUPABASE_ACCESS_TOKEN antes de executar este script." }
$h = @{ Authorization = "Bearer $token" }
$url = "https://api.supabase.com/v1/projects/zjwfymxknibxndaglyuo/database/query"
$base = Split-Path -Parent $MyInvocation.MyCommand.Path

function SendSql([string]$sql, [string]$label) {
    # Converte para JSON e envia como bytes UTF-8 para evitar problemas de encoding
    $jsonStr = @{ query = $sql } | ConvertTo-Json -Depth 3 -Compress
    $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($jsonStr)
    try {
        $null = Invoke-RestMethod -Uri $url -Method POST -Headers $h -Body $bodyBytes `
            -ContentType "application/json; charset=utf-8" -ErrorAction Stop
        return $true
    } catch {
        $raw = $_.ErrorDetails.Message
        $m = if ($raw) {
            try { ($raw | ConvertFrom-Json).message } catch { $raw }
        } else { $_.Exception.Message }
        Write-Host "  [ERR] $label -- $m" -ForegroundColor Red
        return $false
    }
}

function HasSqlContent([string]$stmt) {
    foreach ($ln in ($stmt -split "`n")) {
        $t = $ln.Trim()
        if ($t.Length -gt 0 -and -not $t.StartsWith('--')) { return $true }
    }
    return $false
}

function SplitStatements([string]$raw) {
    $statements = [System.Collections.Generic.List[string]]::new()
    $buf = [System.Text.StringBuilder]::new()
    $inDollar = $false
    $normalized = $raw -replace "`r`n", "`n" -replace "`r", "`n"

    foreach ($line in ($normalized -split "`n")) {
        $ddCount = ([regex]::Matches($line, '\$\$')).Count
        if ($ddCount % 2 -eq 1) { $inDollar = -not $inDollar }

        $null = $buf.AppendLine($line)

        if (-not $inDollar) {
            # Strip inline comment para detectar o ; real da linha
            $lineClean = ($line -replace '\s*--.*$', '').TrimEnd()
            if ($lineClean -match ';\s*$') {
                $stmt = $buf.ToString().Trim()
                if ($stmt.Length -gt 3 -and (HasSqlContent $stmt)) {
                    $statements.Add($stmt)
                }
                $null = $buf.Clear()
            }
        }
    }
    $rest = $buf.ToString().Trim()
    if ($rest.Length -gt 3 -and (HasSqlContent $rest)) { $statements.Add($rest) }
    return $statements
}

function ApplyMigration([int]$fase) {
    $file = "$base\supabase-migration-fase$fase.sql"
    $raw = Get-Content $file -Raw -Encoding UTF8
    $statements = SplitStatements $raw

    Write-Host "  ($($statements.Count) statements encontrados)" -ForegroundColor DarkGray

    $ok = 0
    $fail = 0
    foreach ($s in $statements) {
        if (SendSql $s "f$fase") { $ok++ } else { $fail++ }
    }

    $color = if ($fail -eq 0) { 'Green' } else { 'Yellow' }
    Write-Host "  Fase $fase concluida: $ok OK, $fail falhos / $($statements.Count) statements" -ForegroundColor $color
}

foreach ($f in @(3, 4, 5, 6, 7)) {
    Write-Host "==> Aplicando Fase $f..." -ForegroundColor Cyan
    ApplyMigration $f
}

Write-Host ""
Write-Host "Verificando tabelas criadas..." -ForegroundColor Cyan
$verifySql = "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('labels','conversation_label_map','quick_replies','media_attachments','sla_policies','automation_rules','automation_executions','inbox_alerts','dlq_events') ORDER BY table_name;"
$bv = [System.Text.Encoding]::UTF8.GetBytes((@{ query = $verifySql } | ConvertTo-Json -Depth 3 -Compress))
$r = Invoke-RestMethod -Uri $url -Method POST -Headers $h -Body $bv -ContentType "application/json; charset=utf-8"
$r | ForEach-Object { Write-Host "  OK -- $($_.table_name)" -ForegroundColor Green }
