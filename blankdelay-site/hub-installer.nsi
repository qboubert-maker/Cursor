; BlankDelay Hub — branded Windows installer (BlankDelay logo)
; Controller Macro (Drive redesign) is bundled under resources/controller-macro by electron-builder.
Unicode true
Name "BlankDelay Hub"
BrandingText "BlankDelay"
OutFile "downloads\BlankDelay-Setup.exe"
InstallDir "$LOCALAPPDATA\BlankDelay\Hub"
RequestExecutionLevel user
SetCompressor /SOLID lzma
Icon "build\icon.ico"
UninstallIcon "build\icon.ico"

Page directory
Page instfiles

Section "Install"
  SetOutPath "$INSTDIR"
  File /r "dist\win-unpacked\*.*"

  CreateDirectory "$SMPROGRAMS\BlankDelay"
  CreateShortCut "$SMPROGRAMS\BlankDelay\BlankDelay Hub.lnk" "$INSTDIR\BlankDelay.exe" "" "$INSTDIR\BlankDelay.exe" 0
  CreateShortCut "$DESKTOP\BlankDelay Hub.lnk" "$INSTDIR\BlankDelay.exe" "" "$INSTDIR\BlankDelay.exe" 0

  !macro BDProductShortcut name exeArgs fallbackExe
    IfFileExists "$INSTDIR\${fallbackExe}" 0 +3
      CreateShortCut "$SMPROGRAMS\BlankDelay\${name}.lnk" "$INSTDIR\${fallbackExe}" "" "$INSTDIR\BlankDelay.exe" 0
      Goto +2
    CreateShortCut "$SMPROGRAMS\BlankDelay\${name}.lnk" "$INSTDIR\BlankDelay.exe" "${exeArgs}" "$INSTDIR\BlankDelay.exe" 0
  !macroend

  !insertmacro BDProductShortcut "Premium Utility" "--product=premium" "BlankDelay-Premium-Utility.exe"
  !insertmacro BDProductShortcut "Zero Delay Plus" "--product=zero-plus" "BlankDelay-Zero-Delay-Plus.exe"
  !insertmacro BDProductShortcut "Zero Delay" "--product=zero" "BlankDelay-Zero-Delay.exe"
  !insertmacro BDProductShortcut "FPS Boost" "--product=fps" "BlankDelay-FPS-Boost.exe"
  !insertmacro BDProductShortcut "Ping Optimizer" "--product=ping" "BlankDelay-Ping-Optimizer.exe"
  !insertmacro BDProductShortcut "Keyboard Macro V2" "--product=keyboard" "BlankDelay-Keyboard-Macro-V2.exe"
  !insertmacro BDProductShortcut "Aim Bundle" "--product=aim" "BlankDelay-Aim-Bundle.exe"
  !insertmacro BDProductShortcut "Shotgun Pack" "--product=shotgun" "BlankDelay-Shotgun-Pack.exe"

  ; Controller Macro = Drive app only (own branded exe under resources)
  CreateShortCut "$SMPROGRAMS\BlankDelay\Controller Macro V2.lnk" "$INSTDIR\resources\controller-macro\BlankDelay-Controller-Macro.exe" "" "$INSTDIR\resources\controller-macro\BlankDelay-Controller-Macro.exe" 0
  CreateShortCut "$DESKTOP\BlankDelay Controller Macro V2.lnk" "$INSTDIR\resources\controller-macro\BlankDelay-Controller-Macro.exe" "" "$INSTDIR\resources\controller-macro\BlankDelay-Controller-Macro.exe" 0

  WriteUninstaller "$INSTDIR\Uninstall.exe"
SectionEnd

Section "Uninstall"
  Delete "$SMPROGRAMS\BlankDelay\BlankDelay Hub.lnk"
  Delete "$SMPROGRAMS\BlankDelay\Premium Utility.lnk"
  Delete "$SMPROGRAMS\BlankDelay\Zero Delay Plus.lnk"
  Delete "$SMPROGRAMS\BlankDelay\Zero Delay.lnk"
  Delete "$SMPROGRAMS\BlankDelay\FPS Boost.lnk"
  Delete "$SMPROGRAMS\BlankDelay\Ping Optimizer.lnk"
  Delete "$SMPROGRAMS\BlankDelay\Keyboard Macro V2.lnk"
  Delete "$SMPROGRAMS\BlankDelay\Aim Bundle.lnk"
  Delete "$SMPROGRAMS\BlankDelay\Shotgun Pack.lnk"
  Delete "$SMPROGRAMS\BlankDelay\Controller Macro V2.lnk"
  Delete "$DESKTOP\BlankDelay Hub.lnk"
  Delete "$DESKTOP\BlankDelay Controller Macro V2.lnk"
  RMDir "$SMPROGRAMS\BlankDelay"
  RMDir /r "$INSTDIR"
SectionEnd
