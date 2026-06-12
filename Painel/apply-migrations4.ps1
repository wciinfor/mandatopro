$token = $env:SUPABASE_ACCESS_TOKEN
if (-not $token) { throw "Defina SUPABASE_ACCESS_TOKEN antes de executar este script." }
$h = @{ Authorization = "Bearer $token" }
$url = "https://api.supabase.com/v1/projects/zjwfymxknibxndaglyuo/database/query"
$base = Split-Path -Parent $MyInvocation.MyCommand.Path

# Converte todos os caracteres nao-ASCII para \uXXXX dentro de uma string JSON
# garantindo JSON puro-ASCII compativel com qualquer parser
function EscapeForJson([string]$sql) {
    $sb = [System.Text.StringBuilder]::new()
    $null = $sb.Append('{"query":"')
    foreach ($c in $sql.ToCharArray()) {
        $code = [int][char]$c
        switch ($code) {
            8   { $null = $sb.Append('\b');  break }
            9   { $null = $sb.Append('\t');  break }
            10  { $null = $sb.Append('\n');  break }
            12  { $null = $sb.Append('\f');  break }
            13  { $null = $sb.Append('\r');  break }
            34  { $null = $sb.Append('\"'); break }
            92  { $null = $sb.Append('\\'); break }
            default {
                if ($code -ge 0x20 -and $code -le 0x7E) {
                    $null = $sb.Append($c)
                } else {
                    $null = $sb.Append([string]::Format('\u{0:x4}', $code))
                }
            }
        }
    }
    $null = $sb.Append('"}')
    return $sb.ToString()
}

function SendSql([string]$sql, [string]$label) {
    $jsonStr = EscapeForJson $sql
    $bodyBytes = [System.Text.Encoding]::ASCII.GetBytes($jsonStr)
    try {
        $null = Invoke-RestMethod -Uri $url -Method POST -Headers $h -Body $bodyBytes `
            -ContentType "application/json" -ErrorAction Stop
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
            # Strip inline comment para detectar ; real
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

    Write-Host "  ($($statements.Count) statements)" -ForegroundColor DarkGray

    $ok = 0; $fail = 0
    foreach ($s in $statements) {
        if (SendSql $s "f$fase") { $ok++ } else { $fail++ }
    }

    $color = if ($fail -eq 0) { 'Green' } else { 'Yellow' }
    Write-Host "  Fase $fase: $ok OK, $fail falhos / $($statements.Count) total" -ForegroundColor $color
}

foreach ($f in @(3, 4, 5, 6, 7)) {
    Write-Host "==> Fase $f..." -ForegroundColor Cyan
    ApplyMigration $f
}

Write-Host ""
Write-Host "== Verificando tabelas ==" -ForegroundColor Cyan
$verifySql = "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('labels','conversation_label_map','quick_replies','media_attachments','sla_policies','automation_rules','automation_executions','inbox_alerts','dlq_events') ORDER BY table_name;"
$vb = [System.Text.Encoding]::ASCII.GetBytes((EscapeForJson $verifySql))
$r = Invoke-RestMethod -Uri $url -Method POST -Headers $h -Body $vb -ContentType "application/json"
if ($r) {
    $r | ForEach-Object { Write-Host "  EXISTE: $($_.table_name)" -ForegroundColor Green }
} else {
    Write-Host "  NENHUMA tabela encontrada!" -ForegroundColor Red
}
