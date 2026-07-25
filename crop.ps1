
Add-Type -AssemblyName System.Drawing
$imagePath = 'frontend\public\favicon.png'
$bitmap = [System.Drawing.Bitmap]::FromFile($imagePath)

$minX = $bitmap.Width
$minY = $bitmap.Height
$maxX = 0
$maxY = 0

for ($y = 0; $y -lt $bitmap.Height; $y++) {
    for ($x = 0; $x -lt $bitmap.Width; $x++) {
        $color = $bitmap.GetPixel($x, $y)
        if ($color.R -gt 240 -and $color.G -gt 240 -and $color.B -gt 240) {
            $bitmap.SetPixel($x, $y, [System.Drawing.Color]::Transparent)
        } else {
            if ($x -lt $minX) { $minX = $x }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($y -gt $maxY) { $maxY = $y }
        }
    }
}

$minX = [Math]::Max(0, $minX - 5)
$minY = [Math]::Max(0, $minY - 5)
$maxX = [Math]::Min($bitmap.Width - 1, $maxX + 5)
$maxY = [Math]::Min($bitmap.Height - 1, $maxY + 5)

$rect = New-Object System.Drawing.Rectangle($minX, $minY, ($maxX - $minX + 1), ($maxY - $minY + 1))
$croppedBitmap = $bitmap.Clone($rect, $bitmap.PixelFormat)

$bitmap.Dispose()

$croppedBitmap.Save('frontend\public\favicon_cropped.png', [System.Drawing.Imaging.ImageFormat]::Png)
$croppedBitmap.Dispose()
Write-Host 'Cropped successfully'

