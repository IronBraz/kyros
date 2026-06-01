@echo off
chcp 65001 >nul
cls

echo ============================================================
echo   KYROS — Smoke Test Pre-Demo
echo ============================================================
echo.
echo  Questo script testa il sistema con piu' utenti in parallelo
echo  per verificare che la demo regga senza problemi.
echo.
echo  Cosa serve prima di procedere:
echo    1. Il server n8n deve essere avviato (docker-compose up)
echo    2. Il frontend deve girare (npm run dev in pwa/)
echo    3. Il DB deve avere almeno 1 store e 1 entry point seedati
echo    4. Avere a portata: slug entry point, PIN admin, UUID store
echo.
echo  Dove trovi i valori:
echo    - Entry point slug:  tabella entry_points, colonna slug
echo    - Admin PIN:         tabella admin_access, colonna access_code
echo    - Store ID:          tabella stores, colonna id
echo.
echo ============================================================
echo.

set /p EP_SLUG=Slug entry point (es. main-entrance):
if "%EP_SLUG%"=="" (
    echo ERRORE: slug obbligatorio.
    pause
    exit /b 1
)

set /p ADMIN_PIN=PIN admin (4-6 cifre):
if "%ADMIN_PIN%"=="" (
    echo ERRORE: PIN obbligatorio.
    pause
    exit /b 1
)

set /p STORE_ID=Store ID (UUID):
if "%STORE_ID%"=="" (
    echo ERRORE: Store ID obbligatorio.
    pause
    exit /b 1
)

set /p BASE_URL=Base URL [premi Invio per http://localhost:5173]:
if "%BASE_URL%"=="" set BASE_URL=http://localhost:5173

echo.
echo  Avvio smoke test...
echo  Base URL   : %BASE_URL%
echo  Entry Point: %EP_SLUG%
echo  Store ID   : %STORE_ID%
echo.

powershell -ExecutionPolicy Bypass -File "%~dp0smoke_test.ps1" ^
    -BaseUrl "%BASE_URL%" ^
    -EntryPointSlug "%EP_SLUG%" ^
    -AdminPin "%ADMIN_PIN%" ^
    -StoreId "%STORE_ID%"

echo.
if %ERRORLEVEL%==0 (
    echo  ===  SMOKE TEST SUPERATO — pronto per la demo!  ===
) else (
    echo  ===  SMOKE TEST FALLITO — controlla i FAIL sopra  ===
)

echo.
pause
