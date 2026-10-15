; Builds a tiny branded launcher .exe that starts BlankDelay.exe with --product=<id>
; Usage: makensis /DPRODUCT=keyboard /DOUTFILE=BlankDelay-Keyboard-Macro-V2.exe /DICON=build\icon.ico make-product-launchers.nsi

Unicode true
!ifndef PRODUCT
  !error "Define PRODUCT"
!endif
!ifndef OUTFILE
  !error "Define OUTFILE"
!endif

Name "BlankDelay"
OutFile "${OUTFILE}"
!ifdef ICON
  Icon "${ICON}"
!endif
RequestExecutionLevel user
SilentInstall silent
AutoCloseWindow true

Section
  SetOutPath "$EXEDIR"
  ; Prefer a sibling BlankDelay.exe (installed hub layout)
  IfFileExists "$EXEDIR\BlankDelay.exe" 0 missing
    Exec '"$EXEDIR\BlankDelay.exe" --product=${PRODUCT}'
    Quit
  missing:
    MessageBox MB_OK|MB_ICONSTOP "BlankDelay.exe was not found next to this launcher. Reinstall BlankDelay Hub."
SectionEnd
