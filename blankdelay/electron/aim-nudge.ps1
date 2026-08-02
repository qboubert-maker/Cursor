param([int]$Dx=0,[int]$Dy=0,[int]$Steps=4,[int]$Strength=50)
Add-Type @"using System;using System.Runtime.InteropServices;
public class BdNudge{[DllImport("user32.dll")]public static extern void mouse_event(uint f,int dx,int dy,uint d,UIntPtr e);public const uint MOVE=0x0001;}
"@
if($Dx -eq 0 -and $Dy -eq 0){exit 0}
$sc=[math]::Max(0.05,[math]::Min(1.0,$Strength/100.0));$tx=[int]($Dx*$sc);$ty=[int]($Dy*$sc)
$st=[math]::Max(2,[math]::Min(8,$Steps));$sx=[int]($tx/$st);$sy=[int]($ty/$st);$rx=$tx-($sx*$st);$ry=$ty-($sy*$st)
for($i=0;$i -lt $st;$i++){$mx=$sx;$my=$sy;if($i -eq $st-1){$mx+=$rx;$my+=$ry}
if($mx -ne 0 -or $my -ne 0){[BdNudge]::mouse_event([BdNudge]::MOVE,$mx,$my,0,[UIntPtr]::Zero);Start-Sleep -Milliseconds (2+[int](3*(1-$sc)))}}