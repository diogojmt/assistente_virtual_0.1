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
    this.isReconnecting = false;
    this.currentSocket = null;
  }

  async start() {
    try {
      if (this.isReconnecting) {
        console.log("Reconexão já em andamento, ignorando nova tentativa");
        return;
      }

      const { state, saveCreds } = await useMultiFileAuthState("auth_info");
      const { version } = await fetchLatestBaileysVersion();

      this.currentSocket = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        syncFullHistory: false,
        markOnlineOnConnect: true,
      });

      this.setupEventHandlers(this.currentSocket, saveCreds);
      this.reconnectAttempts = 0;
      this.isReconnecting = false;

    } catch (error) {
      console.error("Erro ao iniciar bot:", error);
      this.isReconnecting = false;
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
      this.isReconnecting = false;
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== 401;

      console.log("Conexão fechada:", lastDisconnect?.error?.message || "Motivo desconhecido");
      console.log("Status code:", statusCode);

      if (shouldReconnect && !this.isReconnecting) {
        this.isReconnecting = true;
        await this.handleReconnect();
      } else if (statusCode === 401) {
        console.log("Erro de autenticação. Remova a pasta auth_info e reinicie.");
        this.isReconnecting = false;
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

    // Ignorar mensagens de protocolo (system messages)
    if (msg.message.protocolMessage || msg.message.senderKeyDistributionMessage) {
      console.log("Mensagem de protocolo/sistema, ignorando");
      return;
    }

    // Ignorar mensagens próprias
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
      this.isReconnecting = false;
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(5000 * this.reconnectAttempts, 30000);

    console.log(`Tentativa ${this.reconnectAttempts}/${this.maxReconnectAttempts} - Reconectando em ${delay / 1000}s...`);

    setTimeout(() => {
      this.isReconnecting = false;
      this.start();
    }, delay);
  }
}

module.exports = WhatsAppBot;
