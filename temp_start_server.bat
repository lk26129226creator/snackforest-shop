@echo off
pushd "%~dp0backend"
set JAVA_CMD=java
set BIN_DIR=%CD%\bin
set LIB_DIR=%CD%\lib\*
echo Starting server with BIN_DIR=%BIN_DIR% and LIB_DIR=%LIB_DIR%
"%JAVA_CMD%" -cp "%BIN_DIR%;%CD%\lib\*" Server
popd
