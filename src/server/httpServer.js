const http = require("http");

class HttpServer {
  constructor(port = 3000) {
    this.port = port;
    this.server = null;
  }

  start() {
    this.server = http.createServer((req, res) => {
      // Log apenas requisições importantes
      if (req.url !== '/health' && req.url !== '/favicon.ico') {
        console.log(`[${new Date().toISOString()}] [HTTP] ${req.method} ${req.url}`);
      }
      
      this.handleRequest(req, res);
    });

    this.server.listen(this.port, () => {
      console.log(`[${new Date().toISOString()}] Servidor HTTP ativo na porta ${this.port}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('Recebido SIGTERM, encerrando servidor...');
      this.server.close(() => {
        console.log('Servidor HTTP encerrado.');
      });
    });
  }

  handleRequest(req, res) {
    const { method, url } = req;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');

    switch (url) {
      case '/health':
        res.writeHead(200);
        res.end(JSON.stringify({ 
          status: 'ok', 
          timestamp: new Date().toISOString(),
          service: 'WhatsApp Bot'
        }));
        break;

      case '/status':
        res.writeHead(200);
        res.end(JSON.stringify({
          status: 'running',
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          timestamp: new Date().toISOString()
        }));
        break;

      default:
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Assistente Virtual da Prefeitura - Bot ativo');
    }
  }
}

module.exports = HttpServer;
