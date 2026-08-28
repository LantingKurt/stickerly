# Local hackathon loop: commit dirty files, pull (merge), push.
# Does not force-push. Aborts a conflicted merge and waits for the next tick.
#
#   .\scripts\hackathon-sync.ps1
#   .\scripts\hackathon-sync.ps1 -Minutes 10
#   .\scripts\hackathon-sync.ps1 -Once
#   .\scripts\hackathon-sync.ps1 -NoCommit -Minutes 1

param(
    [int]$Minutes = 1,
    [switch]$Once,
    [switch]$NoCommit
)

if ($Minutes -lt 1) {
    throw "Minutes must be >= 1"
}

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
    $root = git rev-parse --show-toplevel 2>$null
    if (-not $root) {
        throw "Not inside a git repo"
    }
    return $root.Trim()
}

function Invoke-Git {
    param([Parameter(Mandatory = $true)][string[]]$Args)
    & git @Args
    return $LASTEXITCODE
}

function Sync-Once {
    $branch = (git branch --show-current).Trim()
    if (-not $branch) {
        Write-Host "Detached HEAD — skip this tick"
        return
    }

    if (-not $NoCommit) {
        $null = Invoke-Git @("add", "-A")
        $dirty = git status --porcelain
        if ($dirty) {
            $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
            $null = Invoke-Git @("commit", "-m", "hackathon-sync: autosave $stamp")
            if ($LASTEXITCODE -ne 0) {
                Write-Host "Commit failed — skip this tick"
                return
            }
        }
    }

    $null = Invoke-Git @("fetch", "origin")
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Fetch failed — skip this tick"
        return
    }

    $null = Invoke-Git @("pull", "origin", $branch, "--no-rebase", "--no-edit")
    if ($LASTEXITCODE -ne 0) {
        $null = Invoke-Git @("merge", "--abort")
        Write-Host "Merge conflict on $branch. Fix it, then the next tick will retry."
        return
    }

    $null = Invoke-Git @("push", "-u", "origin", $branch)
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Push failed on $branch"
        return
    }

    Write-Host ("Synced {0} at {1}" -f $branch, (Get-Date -Format "HH:mm:ss"))
}

Set-Location (Get-RepoRoot)
Write-Host ("Hackathon sync every {0} min on {1} (Ctrl+C to stop)" -f $Minutes, (git branch --show-current).Trim())

do {
    Sync-Once
    if ($Once) { break }
    Start-Sleep -Seconds ($Minutes * 60)
} while ($true)
