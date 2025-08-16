require("dotenv").config();
const WhatsAppBot = require('./src/bot/whatsappBot');
const HttpServer = require('./src/server/httpServer');

console.log("Iniciando Assistente Virtual da Prefeitura...");

// Iniciar servidor HTTP
const httpServer = new HttpServer(3000);
httpServer.start();

// Iniciar bot WhatsApp
const bot = new WhatsAppBot();
bot.start().catch(error => {
  console.error("Erro fatal ao iniciar bot:", error);
  process.exit(1);
});

// Tratamento de sinais para encerramento gracioso
process.on('SIGINT', () => {
  console.log('Recebido SIGINT, encerrando aplicação...');
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});
