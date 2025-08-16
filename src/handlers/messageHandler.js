const DocumentService = require("../services/documentService");

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
        data: {
          SSEOperacao: text.trim(),
          SSEChave: process.env.SSE_CHAVE || "@C0sS0_@P1", // Fallback para a chave padrão
        },
      };

      // Pular direto para solicitar CPF/CNPJ para consultar vínculos
      await sock.sendMessage(sender, {
        text: `Você escolheu: ${
          this.tiposDocumento[text.trim()]
        }\n\nInforme seu CPF ou CNPJ para consultar os vínculos disponíveis:`,
      });

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
      default:
        delete this.userStates[sender];
    }
  }

  async handleStep1(sock, sender, text, state) {
    // Agora o step 1 é para consultar vínculos com CPF/CNPJ
    const cpfCnpj = text.trim();

    await sock.sendMessage(sender, {
      text: "🔍 Consultando vínculos... Aguarde um momento.",
    });

    await this.consultarInscricoes(sock, sender, cpfCnpj, state);
  }

  async handleStep2(sock, sender, text, state) {
    // Agora o step 2 é para selecionar a inscrição encontrada
    const indiceInscricao = parseInt(text.trim()) - 1;
    if (state.inscricoes && state.inscricoes[indiceInscricao]) {
      state.data.SSEInscricao = state.inscricoes[indiceInscricao];
      await this.emitirDocumento(sock, sender, state);
    } else {
      await sock.sendMessage(sender, {
        text: "Número inválido. Por favor, digite o número correspondente à inscrição desejada.",
      });
    }
  }

  // Removido handleStep3 e handleStep4 - não são mais necessários
  // O novo fluxo é mais simples: Step1(CPF/CNPJ) -> Step2(Seleção)

  async consultarInscricoes(sock, sender, cpfCnpj, state) {
    try {
      state.data.SSECPFCNPJ = cpfCnpj.trim();
      const inscricoes = await this.documentService.consultarInscricoes(
        cpfCnpj.trim()
      );

      if (inscricoes.length > 0) {
        let msg = "✅ Vínculos encontrados:\n\n";
        inscricoes.forEach((insc, idx) => {
          msg += `${idx + 1}️⃣ Inscrição: ${insc}\n`;
        });
        msg +=
          "\n📝 Digite o número da inscrição desejada para gerar o documento.";
        state.inscricoes = inscricoes;
        state.step = 2; // Próximo step é seleção da inscrição
        // Determinar tipo de contribuinte automaticamente baseado na quantidade de vínculos
        state.data.SSETipoContribuinte = inscricoes.length === 1 ? "1" : "3"; // PF/PJ ou EMPRESA
        await sock.sendMessage(sender, { text: msg });
      } else {
        await sock.sendMessage(sender, {
          text: "❌ Nenhuma inscrição vinculada encontrada para este CPF/CNPJ.\n\nVerifique se o número está correto e tente novamente.",
        });
        delete this.userStates[sender];
      }
    } catch (error) {
      await sock.sendMessage(sender, {
        text: `Erro ao consultar inscrições: ${error.message}`,
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

      const resultado = await this.documentService.emitirDocumento(
        dadosDocumento
      );

      if (resultado.SSACodigo === 0 && resultado.SSALinkDocumento) {
        const tipoDoc = this.tiposDocumento[state.data.SSEOperacao];
        await sock.sendMessage(sender, {
          text: `🎉 *${tipoDoc}* gerado com sucesso!\n\n📄 **Link do documento:** ${resultado.SSALinkDocumento}\n\n✅ Status: ${resultado.SSAMensagem}\n\n_Clique no link acima para visualizar/baixar seu documento._`,
        });
      } else {
        await sock.sendMessage(sender, {
          text: `❌ Não foi possível emitir o documento.\n\n**Motivo:** ${
            resultado.SSAMensagem || "Erro desconhecido"
          }\n\nTente novamente ou entre em contato com o suporte.`,
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
