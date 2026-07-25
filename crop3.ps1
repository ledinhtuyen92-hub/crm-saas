
Add-Type -AssemblyName System.Drawing
$imagePath = 'C:\Users\Admin\.gemini\antigravity-ide\brain\4fefbb68-140c-4956-b267-a17411cf72b4\crm_favicon_1784967605189.png'
$srcBitmap = [System.Drawing.Bitmap]::FromFile($imagePath)

$minX = $srcBitmap.Width
$minY = $srcBitmap.Height
$maxX = 0
$maxY = 0

for ($y = 0; $y -lt $srcBitmap.Height; $y++) {
    for ($x = 0; $x -lt $srcBitmap.Width; $x++) {
        $color = $srcBitmap.GetPixel($x, $y)
        $isBg = ($color.A -lt 10) -or ($color.R -gt 240 -and $color.G -gt 240 -and $color.B -gt 240)
        if (-not $isBg) {
            if ($x -lt $minX) { $minX = $x }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($y -gt $maxY) { $maxY = $y }
        }
    }
}

if ($minX -gt $maxX) {
    Write-Host 'Image is completely empty'
    exit
}

$minX = [Math]::Max(0, $minX - 5)
$minY = [Math]::Max(0, $minY - 5)
$maxX = [Math]::Min($srcBitmap.Width - 1, $maxX + 5)
$maxY = [Math]::Min($srcBitmap.Height - 1, $maxY + 5)

$rect = New-Object System.Drawing.Rectangle($minX, $minY, ($maxX - $minX + 1), ($maxY - $minY + 1))
$croppedBitmap = New-Object System.Drawing.Bitmap($rect.Width, $rect.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($croppedBitmap)
$g.Clear([System.Drawing.Color]::Transparent)

# Copy the pixels manually to ensure we replace white with transparent
for ($y = 0; $y -lt $rect.Height; $y++) {
    for ($x = 0; $x -lt $rect.Width; $x++) {
        $color = $srcBitmap.GetPixel($x + $minX, $y + $minY)
        $isBg = ($color.A -lt 10) -or ($color.R -gt 240 -and $color.G -gt 240 -and $color.B -gt 240)
        if ($isBg) {
            $croppedBitmap.SetPixel($x, $y, [System.Drawing.Color]::Transparent)
        } else {
            $croppedBitmap.SetPixel($x, $y, $color)
        }
    }
}

$g.Dispose()
$srcBitmap.Dispose()

$croppedBitmap.Save('frontend\public\favicon.png', [System.Drawing.Imaging.ImageFormat]::Png)
$croppedBitmap.Dispose()
Write-Host 'Cropped perfectly'

