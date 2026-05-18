$url    = "https://YOUR_DEPLOYMENT.vercel.app/api/digest"
$secret = "YOUR_CRON_SECRET"

$response = Invoke-WebRequest -Uri $url -Method GET -Headers @{ Authorization = "Bearer $secret" }
Write-Host $response.Content
