# Script para resetar autenticação do WhatsApp Bot
Write-Host "🔄 Limpando sessão do WhatsApp..." -ForegroundColor Yellow

$authFolder = "auth_info"

if (Test-Path $authFolder) {
    Remove-Item -Path $authFolder -Recurse -Force
    Write-Host "✅ Pasta auth_info removida com sucesso!" -ForegroundColor Green
} else {
    Write-Host "ℹ️  Pasta auth_info não encontrada (já estava limpa)" -ForegroundColor Cyan
}

Write-Host "`n✨ Pronto! Agora você pode reiniciar o bot e escanear o QR Code novamente." -ForegroundColor Green
Write-Host "   Execute: npm start" -ForegroundColor White
