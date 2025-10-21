@echo off
echo 啟動 SnackForest Shop 伺服器...
echo.

cd /d "%~dp0backend"

echo 檢查編譯...
javac -cp "lib/*;." -d bin src/*.java src/dao/*.java src/model/*.java
if %errorlevel% neq 0 (
    echo 編譯失敗！
    pause
    exit /b 1
)

echo 伺服器將在 http://localhost:8000 運行
echo 要停止伺服器，請按 Ctrl+C
echo.

REM 使用 start 在新視窗中運行，避免干擾
start "SnackForest Server" /wait java -cp "bin;lib/*" Server

echo.
echo 伺服器已停止。
pause