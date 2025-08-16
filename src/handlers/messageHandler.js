const DocumentService = require('../services/documentService');

class MessageHandler {
  constructor() {
    this.documentService = new DocumentService();
    this.userStates = {};
    this.greetedUsers = {};
    this.invalidWarned = {};
    this.justWelcomed = {};
    this.tipoContribuinteWarned = {};
    
    this.tiposDocumento = {
      1: "Demonstrativo",
      2: "Certidão", 
      3: "BCI",
      4: "BCM",
      5: "Alvará de Funcionamento",
      6: "VISA",
    };
  }

  async handleMessage(sock, sender, text) {
    if (!text) return;

    // Mensagem de boas-vindas
    if (!this.greetedUsers[sender]) {
      await this.sendWelcomeMessage(sock, sender);
      return;
    }

    // Menu principal
    if (!this.userStates[sender]) {
      await this.handleMainMenu(sock, sender, text);
      return;
    }

    // Fluxo guiado
    await this.handleGuidedFlow(sock, sender, text);
  }

  async sendWelcomeMessage(sock, sender) {
    this.greetedUsers[sender] = true;
    let menu = "Olá, seja bem-vindo ao Assistente Virtual da Prefeitura!\n\n";
    menu += "Escolha o tipo de documento que deseja emitir:\n";
    Object.entries(this.tiposDocumento).forEach(([key, value]) => {
      menu += `${key}️⃣ ${value}\n`;
    });
    menu += "\nDigite o número da opção desejada para continuar.";
    
    await sock.sendMessage(sender, { text: menu });
    this.justWelcomed[sender] = true;
  }

  async handleMainMenu(sock, sender, text) {
    if (this.tiposDocumento[text.trim()]) {
      this.userStates[sender] = { 
        step: 1, 
        data: { SSEOperacao: text.trim() } 
      };
      
      if (process.env.SSE_CHAVE) {
        this.userStates[sender].data.SSEChave = process.env.SSE_CHAVE;
        this.userStates[sender].step = 2;
        await sock.sendMessage(sender, {
          text: "Informe o TIPO DE CONTRIBUINTE (1-PF/PJ, 2-IMOVEL, 3-EMPRESA):",
        });
      } else {
        await sock.sendMessage(sender, {
          text: "Informe a CHAVE DE ACESSO (SSEChave):",
        });
      }
      this.justWelcomed[sender] = false;
    } else {
      if (!this.invalidWarned[sender] && !this.justWelcomed[sender]) {
        await sock.sendMessage(sender, {
          text: "Opção inválida. Por favor, digite o número correspondente ao tipo de documento desejado.",
        });
        this.invalidWarned[sender] = true;
      }
      this.justWelcomed[sender] = false;
    }
  }

  async handleGuidedFlow(sock, sender, text) {
    this.invalidWarned[sender] = false;
    const state = this.userStates[sender];
    
    switch (state.step) {
      case 1:
        await this.handleStep1(sock, sender, text, state);
        break;
      case 2:
        await this.handleStep2(sock, sender, text, state);
        break;
      case 3:
        await this.handleStep3(sock, sender, text, state);
        break;
      case 4:
        await this.handleStep4(sock, sender, text, state);
        break;
      default:
        delete this.userStates[sender];
    }
  }

  async handleStep1(sock, sender, text, state) {
    if (!state.data.SSEChave) {
      state.data.SSEChave = text;
    }
    state.step++;
    await sock.sendMessage(sender, {
      text: "Informe o TIPO DE CONTRIBUINTE (1-PF/PJ, 2-IMOVEL, 3-EMPRESA):",
    });
  }

  async handleStep2(sock, sender, text, state) {
    if (!["1", "2", "3"].includes(text.trim())) {
      if (!this.tipoContribuinteWarned[sender]) {
        await sock.sendMessage(sender, {
          text: "Tipo de contribuinte inválido. Por favor, digite 1 para PF/PJ, 2 para IMOVEL ou 3 para EMPRESA.",
        });
        this.tipoContribuinteWarned[sender] = true;
      }
      return;
    }
    
    this.tipoContribuinteWarned[sender] = false;
    state.data.SSETipoContribuinte = text.trim();
    state.step++;
    
    if (text.trim() === "1") {
      await sock.sendMessage(sender, {
        text: "Informe o CPF ou CNPJ para consultar as inscrições vinculadas:",
      });
    } else {
      await sock.sendMessage(sender, {
        text: "Informe a INSCRIÇÃO MUNICIPAL (SSEInscricao):",
      });
    }
  }

  async handleStep3(sock, sender, text, state) {
    if (state.data.SSETipoContribuinte === "1") {
      await this.consultarInscricoes(sock, sender, text, state);
    } else {
      state.data.SSEInscricao = text;
      await this.emitirDocumento(sock, sender, state);
    }
  }

  async handleStep4(sock, sender, text, state) {
    const indiceInscricao = parseInt(text.trim()) - 1;
    if (state.inscricoes && state.inscricoes[indiceInscricao]) {
      state.data.SSEInscricao = state.inscricoes[indiceInscricao];
      await this.emitirDocumento(sock, sender, state);
    } else {
      await sock.sendMessage(sender, { 
        text: 'Número inválido. Tente novamente.' 
      });
    }
  }

  async consultarInscricoes(sock, sender, cpfCnpj, state) {
    try {
      state.data.SSECPFCNPJ = cpfCnpj.trim();
      const inscricoes = await this.documentService.consultarInscricoes(cpfCnpj.trim());
      
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
        await sock.sendMessage(sender, { 
          text: 'Nenhuma inscrição vinculada encontrada para este CPF/CNPJ.' 
        });
        delete this.userStates[sender];
      }
    } catch (error) {
      await sock.sendMessage(sender, { 
        text: `Erro ao consultar inscrições: ${error.message}` 
      });
      delete this.userStates[sender];
    }
  }

  async emitirDocumento(sock, sender, state) {
    try {
      const dadosDocumento = this.documentService.prepararDadosDocumento(
        state.data.SSEOperacao,
        state.data.SSEChave,
        state.data.SSETipoContribuinte,
        state.data.SSEInscricao,
        state.data.SSECPFCNPJ || ""
      );

      const resultado = await this.documentService.emitirDocumento(dadosDocumento);
      
      if (resultado.SSACodigo === 0 && resultado.SSALinkDocumento) {
        await sock.sendMessage(sender, {
          text: `Documento disponível: ${resultado.SSALinkDocumento}\nMensagem: ${resultado.SSAMensagem}`,
        });
      } else {
        await sock.sendMessage(sender, {
          text: `Não foi possível emitir o documento. Motivo: ${
            resultado.SSAMensagem || "Erro desconhecido"
          }`,
        });
      }
    } catch (error) {
      await sock.sendMessage(sender, {
        text: `Erro ao consultar documento: ${error.message}`,
      });
    }
    
    delete this.userStates[sender];
  }

  resetUserState(sender) {
    delete this.userStates[sender];
    delete this.greetedUsers[sender];
    delete this.invalidWarned[sender];
    delete this.justWelcomed[sender];
    delete this.tipoContribuinteWarned[sender];
  }
}

module.exports = MessageHandler;
