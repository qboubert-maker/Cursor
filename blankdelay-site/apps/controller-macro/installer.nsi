; BlankDelay Controller Macro V2 — Windows installer
Unicode true
Name "BlankDelay Controller Macro V2"
OutFile "..\..\downloads\BlankDelay-Controller-Macro-V2-Setup.exe"
InstallDir "$LOCALAPPDATA\BlankDelay\ControllerMacroV2"
RequestExecutionLevel user
SetCompressor /SOLID lzma
SilentInstall normal

Page directory
Page instfiles

Section "Install"
  SetOutPath "$INSTDIR"
  File /r "runtime\*.*"
  CreateDirectory "$SMPROGRAMS\BlankDelay"
  CreateShortCut "$SMPROGRAMS\BlankDelay\Controller Macro V2.lnk" "$INSTDIR\BlankDelay-Controller-Macro.exe"
  CreateShortCut "$DESKTOP\BlankDelay Controller Macro V2.lnk" "$INSTDIR\BlankDelay-Controller-Macro.exe"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
SectionEnd

Section "Uninstall"
  Delete "$SMPROGRAMS\BlankDelay\Controller Macro V2.lnk"
  Delete "$DESKTOP\BlankDelay Controller Macro V2.lnk"
  RMDir "$SMPROGRAMS\BlankDelay"
  RMDir /r "$INSTDIR"
SectionEnd
