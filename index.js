const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} = require("@whiskeysockets/baileys");
const axios = require("axios");
require("dotenv").config();
const qrcode = require("qrcode-terminal");

// Servidor HTTP para manter o processo ativo
const http = require("http");
http
  .createServer((req, res) => {
    res.writeHead(200);
    res.end("Bot ativo");
  })
  .listen(3000);

async function startBot() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState("auth_info");
    const { version, isLatest } = await fetchLatestBaileysVersion();
    const sock = makeWASocket({
      version,
      auth: state,
      // O Baileys já está em modo MD por padrão
    });

    sock.ev.on("creds.update", saveCreds);
    // Exibe QR code manualmente conforme recomendação Baileys
    sock.ev.on("connection.update", (update) => {
      const { qr, lastDisconnect, connection } = update;
      if (qr) {
        console.log("QR Code para conexão WhatsApp:");
        qrcode.generate(qr, { small: true });
      }
      if (connection === "close") {
        const shouldReconnect =
          lastDisconnect?.error?.output?.statusCode !== 401;
        console.log("Conexão fechada. Motivo:", lastDisconnect?.error);
        if (shouldReconnect) {
          console.log("Tentando reconectar em 5 segundos...");
          setTimeout(startBot, 5000);
        } else {
          console.log("Erro de autenticação. Escaneie o QR novamente.");
        }
      }
    });

    // Armazena estado de coleta de dados por usuário
    const userStates = {};
    // Armazena se o usuário já recebeu boas-vindas
    const greetedUsers = {};
    // Mapeamento dos tipos de documento
    const tiposDocumento = {
      1: "Demonstrativo",
      2: "Certidão",
      3: "BCI",
      4: "BCM",
      5: "Alvará de Funcionamento",
      6: "VISA",
    };

    sock.ev.on("messages.upsert", async ({ messages }) => {
      const msg = messages[0];
      if (!msg.message) return;
      const sender = msg.key.remoteJid;
      const text =
        msg.message.conversation || msg.message.extendedTextMessage?.text;
      if (!text) return;

      // Mensagem de boas-vindas e menu de documentos
      if (!greetedUsers[sender]) {
        greetedUsers[sender] = true;
        let menu =
          "Olá, seja bem-vindo ao Assistente Virtual da Prefeitura!\n\n";
        menu += "Escolha o tipo de documento que deseja emitir:\n";
        Object.entries(tiposDocumento).forEach(([key, value]) => {
          menu += `${key}️⃣ ${value}\n`;
        });
        menu += "\nDigite o número da opção desejada para continuar.";
        await sock.sendMessage(sender, { text: menu });
        return;
      }

      // Menu principal: escolha do tipo de documento
      if (!userStates[sender]) {
        if (tiposDocumento[text.trim()]) {
          userStates[sender] = { step: 1, data: { SSEOperacao: text.trim() } };
          // Usa a chave do .env se existir
          if (process.env.SSE_CHAVE) {
            userStates[sender].data.SSEChave = process.env.SSE_CHAVE;
            userStates[sender].step = 2;
            await sock.sendMessage(sender, {
              text: "Informe o TIPO DE CONTRIBUINTE (1-PF/PJ, 2-IMOVEL, 3-EMPRESA):",
            });
          } else {
            await sock.sendMessage(sender, {
              text: "Informe a CHAVE DE ACESSO (SSEChave):",
            });
          }
          return;
        } else {
          await sock.sendMessage(sender, {
            text: "Opção inválida. Por favor, digite o número correspondente ao tipo de documento desejado.",
          });
          return;
        }
      }

      // Fluxo guiado para emissão do documento
      if (userStates[sender]) {
        const state = userStates[sender];
        switch (state.step) {
          case 1:
            // Só solicita se não veio do .env
            if (!state.data.SSEChave) {
              state.data.SSEChave = text;
            }
            state.step++;
            await sock.sendMessage(sender, {
              text: "Informe o TIPO DE CONTRIBUINTE (1-PF/PJ, 2-IMOVEL, 3-EMPRESA):",
            });
            break;
          case 2:
            state.data.SSETipoContribuinte = text;
            state.step++;
            await sock.sendMessage(sender, {
              text: "Informe a INSCRIÇÃO MUNICIPAL (SSEInscricao):",
            });
            break;
          case 3:
            state.data.SSEInscricao = text;
            state.step++;
            // Preenche campos não utilizados
            state.data.SSEExercicioDebito = "";
            state.data.SSETipoConsumo = "";
            state.data.SSENossoNumero = "";
            state.data.SSECPFCNPJ = "";
            state.data.SSEIdentificador = "";

            // Chama API
            try {
              const response = await axios.get(
                "https://homologacao.abaco.com.br/arapiraca_proj_hml_eagata/servlet/apapidocumento",
                {
                  headers: {
                    DadosAPIDocumento: JSON.stringify(state.data),
                  },
                }
              );
              const dados = response.data;
              if (dados.SSACodigo === 0 && dados.SSALinkDocumento) {
                await sock.sendMessage(sender, {
                  text: `Documento disponível: ${dados.SSALinkDocumento}\nMensagem: ${dados.SSAMensagem}`,
                });
              } else {
                await sock.sendMessage(sender, {
                  text: `Não foi possível emitir o documento. Motivo: ${
                    dados.SSAMensagem || "Erro desconhecido"
                  }`,
                });
              }
            } catch (err) {
              await sock.sendMessage(sender, {
                text: `Erro ao consultar documento: ${err.message}`,
              });
            }
            delete userStates[sender];
            break;
          default:
            delete userStates[sender];
        }
        return;
      }

      // Resposta padrão
      await sock.sendMessage(sender, { text: `Olá! Você disse: ${text}` });
    });
  } catch (err) {
    console.error("Erro na conexão:", err);
    console.log("Tentando reconectar em 5 segundos...");
    setTimeout(startBot, 5000);
  }
}

startBot();
