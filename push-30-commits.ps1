$ErrorActionPreference = "Stop"

$expectedCommits = 30
$actualCommits = [int](git rev-list --count HEAD)

if ($LASTEXITCODE -ne 0) {
    throw "This folder is not a valid Git repository."
}

if ($actualCommits -ne $expectedCommits) {
    throw "Expected $expectedCommits commits, but found $actualCommits. Stop and check the project folder."
}

$remoteUrl = git remote get-url origin 2>$null
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($remoteUrl)) {
    throw "No origin remote exists. Run: git remote add origin https://github.com/ggvolta/BookSwap.git"
}

Write-Host "Repository: $remoteUrl"
Write-Host "Commits to push separately: $actualCommits"
$confirmation = Read-Host "Type YES to begin"

if ($confirmation -ne "YES") {
    Write-Host "Cancelled."
    exit 0
}

$commits = @(git rev-list --reverse HEAD)
$number = 1

foreach ($commit in $commits) {
    Write-Host "Pushing commit $number of $expectedCommits: $commit"
    git push origin "${commit}:refs/heads/main"
    if ($LASTEXITCODE -ne 0) {
        throw "Push $number failed. Fix the error, then run the script again."
    }
    $number++
}

git branch --set-upstream-to=origin/main main | Out-Null
Write-Host "All 30 commits were pushed successfully."
