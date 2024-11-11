@echo off
setlocal enabledelayedexpansion

set "bindings="

for /f "usebackq tokens=*" %%a in (".env.local") do (
    set "line=%%a"
    if "!line:~0,1!" neq "#" if not "!line!"=="" (
        for /f "tokens=1,* delims==" %%b in ("!line!") do (
            set "name=%%b"
            set "value=%%c"
            set "value=!value:"=!"
            set "bindings=!bindings!--binding !name!=!value! "
        )
    )
)

set "bindings=!bindings:~0,-1!"
echo !bindings!
