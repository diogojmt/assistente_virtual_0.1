const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} = require("@whiskeysockets/baileys");
const qrcode = require("qrcode-terminal");
const MessageHandler = require('../handlers/messageHandler');

class WhatsAppBot {
  constructor() {
    this.messageHandler = new MessageHandler();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  async start() {
    try {
      const { state, saveCreds } = await useMultiFileAuthState("auth_info");
      const { version } = await fetchLatestBaileysVersion();
      
      const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
      });

      this.setupEventHandlers(sock, saveCreds);
      this.reconnectAttempts = 0;
      
    } catch (error) {
      console.error("Erro ao iniciar bot:", error);
      await this.handleReconnect();
    }
  }

  setupEventHandlers(sock, saveCreds) {
    sock.ev.on("creds.update", saveCreds);
    
    sock.ev.on("connection.update", async (update) => {
      await this.handleConnectionUpdate(update);
    });

    sock.ev.on("messages.upsert", async (m) => {
      const messages = m.messages;
      if (m.type === 'notify') {
        await this.handleNewMessages(sock, messages);
      }
    });
  }

  async handleConnectionUpdate(update) {
    const { qr, lastDisconnect, connection } = update;
    
    if (qr) {
      console.log("Escaneie o QR Code abaixo para conectar:");
      qrcode.generate(qr, { small: true });
    }
    
    if (connection === "open") {
      console.log(`[${new Date().toISOString()}] Bot conectado com sucesso!`);
      this.reconnectAttempts = 0;
    }
    
    if (connection === "close") {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
      console.log("Conexão fechada:", lastDisconnect?.error?.message || "Motivo desconhecido");
      
      if (shouldReconnect) {
        await this.handleReconnect();
      } else {
        console.log("Erro de autenticação. Remova a pasta auth_info e reinicie.");
      }
    }
  }

  async handleNewMessages(sock, messages) {
    console.log(`[${new Date().toISOString()}] Nova mensagem recebida:`, messages);
    
    const msg = messages[0];
    if (!msg.message) {
      console.log("Mensagem sem conteúdo, ignorando");
      return;
    }
    
    if (msg.key.fromMe) {
      console.log("Mensagem própria, ignorando");
      return;
    }

    const sender = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
    
    console.log(`[${new Date().toISOString()}] Sender: ${sender}, Text: ${text}`);
    
    if (!text) {
      console.log("Texto vazio, ignorando");
      return;
    }
    
    try {
      console.log("Chamando messageHandler.handleMessage...");
      await this.messageHandler.handleMessage(sock, sender, text);
      console.log("messageHandler.handleMessage concluído");
    } catch (error) {
      console.error("Erro ao processar mensagem:", error);
      await sock.sendMessage(sender, {
        text: "Desculpe, ocorreu um erro interno. Tente novamente mais tarde."
      });
    }
  }

  async handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("Número máximo de tentativas de reconexão atingido.");
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(5000 * this.reconnectAttempts, 30000);
    
    console.log(`Tentativa ${this.reconnectAttempts}/${this.maxReconnectAttempts} - Reconectando em ${delay/1000}s...`);
    
    setTimeout(() => {
      this.start();
    }, delay);
  }
}

module.exports = WhatsAppBot;
