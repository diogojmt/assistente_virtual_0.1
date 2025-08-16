const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} = require("@whiskeysockets/baileys");
const axios = require("axios");
require("dotenv").config();
const soapRequest = require('easy-soap-request');
const xml2js = require('xml2js');
const qrcode = require("qrcode-terminal");

// Remover log de chave sensível
console.log("Bot iniciando...");

// Servidor HTTP para manter o processo ativo
const http = require("http");
http
  .createServer((req, res) => {
    console.log(
      `[${new Date().toISOString()}] [HTTP] ${req.method} ${req.url}`
    );
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Bot ativo");
  })
  .listen(3000, () => {
    console.log(
      `[${new Date().toISOString()}] Servidor HTTP ativo na porta 3000.`
    );
  });

async function startBot() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState("auth_info");
    const { version, isLatest } = await fetchLatestBaileysVersion();
    const sock = makeWASocket({
      version,
      auth: state,
    });

    sock.ev.on("creds.update", saveCreds);
    
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

    // Estados do usuário
    const userStates = {};
    const greetedUsers = {};
    const invalidWarned = {};
    const justWelcomed = {};
    const tipoContribuinteWarned = {};
    
    const tiposDocumento = {
      1: "Demonstrativo",
      2: "Certidão",
      3: "BCI",
      4: "BCM",
      5: "Alvará de Funcionamento",
      6: "VISA",
    };

    sock.ev.on("messages.new", async (messages) => {
      const msg = messages[0];
      if (!msg.message) return;

      const sender = msg.key.remoteJid;
      const text =
        msg.message.conversation || msg.message.extendedTextMessage?.text;
      if (!text) return;

      // Mensagem de boas-vindas
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
        justWelcomed[sender] = true;
        return;
      }

      // Menu principal
      if (!userStates[sender]) {
        if (tiposDocumento[text.trim()]) {
          userStates[sender] = { step: 1, data: { SSEOperacao: text.trim() } };
          
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
          justWelcomed[sender] = false;
          return;
        } else {
          if (!invalidWarned[sender] && !justWelcomed[sender]) {
            await sock.sendMessage(sender, {
              text: "Opção inválida. Por favor, digite o número correspondente ao tipo de documento desejado.",
            });
            invalidWarned[sender] = true;
          }
          justWelcomed[sender] = false;
          return;
        }
      }

      // Fluxo guiado
      if (userStates[sender]) {
        invalidWarned[sender] = false;
        const state = userStates[sender];
        
        switch (state.step) {
          case 1:
            if (!state.data.SSEChave) {
              state.data.SSEChave = text;
            }
            state.step++;
            await sock.sendMessage(sender, {
              text: "Informe o TIPO DE CONTRIBUINTE (1-PF/PJ, 2-IMOVEL, 3-EMPRESA):",
            });
            break;

          case 2:
            if (!["1", "2", "3"].includes(text.trim())) {
              if (!tipoContribuinteWarned[sender]) {
                await sock.sendMessage(sender, {
                  text: "Tipo de contribuinte inválido. Por favor, digite 1 para PF/PJ, 2 para IMOVEL ou 3 para EMPRESA.",
                });
                tipoContribuinteWarned[sender] = true;
              }
              return;
            }
            tipoContribuinteWarned[sender] = false;
            state.data.SSETipoContribuinte = text.trim();
            state.step++;
            
            // Verificar se é opção que precisa consultar inscrições
            if (text.trim() === "1") {
              await sock.sendMessage(sender, {
                text: "Informe o CPF ou CNPJ para consultar as inscrições vinculadas:",
              });
            } else {
              await sock.sendMessage(sender, {
                text: "Informe a INSCRIÇÃO MUNICIPAL (SSEInscricao):",
              });
            }
            break;

          case 3:
            if (state.data.SSETipoContribuinte === "1") {
              // Consulta inscrições via SOAP
              const cpfCnpj = text.trim();
              state.data.SSECPFCNPJ = cpfCnpj;
              
              try {
                const url = 'https://homologacao.abaco.com.br/arapiraca_proj_hml_eagata/servlet/apwsretornopertences';
                const xml = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:eag="eAgata_Arapiraca_Maceio_Ev3">
   <soapenv:Header/>
   <soapenv:Body>
      <eag:PWSRetornoPertences.Execute>
         <eag:Flagtipopesquisa>C</eag:Flagtipopesquisa>
         <eag:Ctgcpf>${cpfCnpj}</eag:Ctgcpf>
         <eag:Ctiinscricao></eag:Ctiinscricao>
      </eag:PWSRetornoPertences.Execute>
   </soapenv:Body>
</soapenv:Envelope>`;
                
                const headers = {
                  'Content-Type': 'text/xml;charset=UTF-8',
                  'soapAction': ''
                };
                
                const { response } = await soapRequest({ url, headers, xml });
                const { body } = response;
                const result = await xml2js.parseStringPromise(body, { explicitArray: false });
                
                let inscricoes = [];
                try {
                  const pertences = result['soapenv:Envelope']['soapenv:Body']['ns1:PWSRetornoPertences.ExecuteResponse']['ns1:PWSRetornoPertences.ExecuteResult']['Pertences']['Pertence'];
                  if (Array.isArray(pertences)) {
                    inscricoes = pertences.map(p => p.Inscricao);
                  } else if (pertences) {
                    inscricoes = [pertences.Inscricao];
                  }
                } catch (e) {
                  inscricoes = [];
                }
                
                if (inscricoes.length > 0) {
                  let msg = 'Inscrições vinculadas encontradas:\n';
                  inscricoes.forEach((insc, idx) => {
                    msg += `${idx + 1} - ${insc}\n`;
                  });
                  msg += '\nDigite o número da inscrição desejada.';
                  state.inscricoes = inscricoes;
                  state.step++;
                  await sock.sendMessage(sender, { text: msg });
                } else {
                  await sock.sendMessage(sender, { text: 'Nenhuma inscrição vinculada encontrada para este CPF/CNPJ.' });
                  delete userStates[sender];
                }
              } catch (err) {
                console.error("Erro na consulta SOAP:", err);
                await sock.sendMessage(sender, { text: `Erro ao consultar inscrições: ${err.message}` });
                delete userStates[sender];
              }
            } else {
              // Para outros tipos, vai direto para inscrição
              state.data.SSEInscricao = text;
              await emitirDocumento(sock, sender, state);
            }
            break;

          case 4:
            // Seleção de inscrição da lista
            const indiceInscricao = parseInt(text.trim()) - 1;
            if (state.inscricoes && state.inscricoes[indiceInscricao]) {
              state.data.SSEInscricao = state.inscricoes[indiceInscricao];
              await emitirDocumento(sock, sender, state);
            } else {
              await sock.sendMessage(sender, { text: 'Número inválido. Tente novamente.' });
            }
            break;

          default:
            delete userStates[sender];
        }
        return;
      }

      await sock.sendMessage(sender, { text: `Olá! Você disse: ${text}` });
    });

  } catch (err) {
    console.error("Erro na conexão:", err);
    console.log("Tentando reconectar em 5 segundos...");
    setTimeout(startBot, 5000);
  }
}

async function emitirDocumento(sock, sender, state) {
  try {
    // Preenche campos não utilizados
    state.data.SSEExercicioDebito = "";
    state.data.SSETipoConsumo = "";
    state.data.SSENossoNumero = "";
    state.data.SSEIdentificador = "";

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
    console.error("Erro ao emitir documento:", err);
    await sock.sendMessage(sender, {
      text: `Erro ao consultar documento: ${err.message}`,
    });
  }
  
  delete userStates[sender];
}

startBot();
