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

  // Converte número para emojis (ex: 10 -> 1️⃣0️⃣)
  numberToEmojis(num) {
    const emojiMap = {
      '0': '0️⃣', '1': '1️⃣', '2': '2️⃣', '3': '3️⃣', '4': '4️⃣',
      '5': '5️⃣', '6': '6️⃣', '7': '7️⃣', '8': '8️⃣', '9': '9️⃣'
    };
    return num.toString().split('').map(digit => emojiMap[digit]).join('');
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
    await sock.sendMessage(sender, {
      text: "Olá! Seja bem-vindo ao Assistente Virtual da Prefeitura!\n\n📋 Digite seu CPF ou CNPJ para consultar os vínculos cadastrados:"
    });
    this.justWelcomed[sender] = true;
  }

  async handleMainMenu(sock, sender, text) {
    // Iniciar diretamente com consulta de vínculos
    this.userStates[sender] = {
      step: 1,
      data: {},
      inscricoes: [],
    };

    // Processar o CPF/CNPJ fornecido
    await this.consultarInscricoes(sock, sender, text, this.userStates[sender]);
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
    // Agora o step 1 é para consultar vínculos com CPF/CNPJ
    const cpfCnpj = text.trim();

    await sock.sendMessage(sender, {
      text: "🔍 Consultando vínculos... Aguarde um momento.",
    });

    await this.consultarInscricoes(sock, sender, cpfCnpj, state);
  }

  async handleStep2(sock, sender, text, state) {
    // Pergunta se quer emitir documento
    const opcao = parseInt(text.trim());

    if (opcao === 1) {
      // Sim, emitir documento
      let msg = "📋 *Selecione o vínculo para emitir documento:*\n\n";

      const LIMITE_EXIBICAO = 20;
      const vinculos_exibir = state.inscricoes.slice(0, LIMITE_EXIBICAO);

      vinculos_exibir.forEach((insc, idx) => {
        msg += `${this.numberToEmojis(idx + 1)} - ${insc.tipo}: ${insc.inscricao}`;
        if (insc.endereco) {
          msg += ` - ${insc.endereco.substring(0, 50)}${insc.endereco.length > 50 ? '...' : ''}`;
        }
        msg += `\n`;
      });

      msg += `\n💬 Digite o número do vínculo:`;

      await sock.sendMessage(sender, { text: msg });
      state.step = 3; // Próximo: selecionar vínculo
    } else if (opcao === 2) {
      // Não, encerrar
      await sock.sendMessage(sender, {
        text: "👋 Atendimento encerrado. Obrigado por utilizar nosso serviço!\n\nSe precisar de algo, é só me chamar novamente."
      });
      delete this.userStates[sender];
    } else {
      await sock.sendMessage(sender, {
        text: "❌ Opção inválida. Digite 1 para emitir documento ou 2 para encerrar."
      });
    }
  }

  async handleStep3(sock, sender, text, state) {
    // Seleção do vínculo
    const indiceInscricao = parseInt(text.trim()) - 1;

    if (state.inscricoes && state.inscricoes[indiceInscricao]) {
      const inscricaoSelecionada = state.inscricoes[indiceInscricao];
      state.data.SSEInscricao = inscricaoSelecionada.inscricao;
      state.data.inscricaoSelecionada = inscricaoSelecionada;

      // Determinar tipo de contribuinte (1 - PF/PJ | 2 - IMOVEL | 3 - EMPRESA)
      state.data.SSETipoContribuinte = inscricaoSelecionada.tipo === 'EMPRESA' ? '3' : '2';

      // Mostrar menu de tipos de documento
      let msg = `📄 *Vínculo selecionado:*\n`;
      msg += `${inscricaoSelecionada.tipo}: ${inscricaoSelecionada.inscricao}\n\n`;
      msg += `*Selecione o tipo de documento:*\n\n`;
      msg += `1️⃣ - Demonstrativo\n`;
      msg += `2️⃣ - Certidão\n`;
      msg += `3️⃣ - BCI (Boletim de Cadastro Imobiliário)\n`;
      msg += `4️⃣ - BCM (Boletim de Cadastro Mercantil)\n`;
      msg += `5️⃣ - Alvará de Funcionamento\n`;
      msg += `6️⃣ - VISA\n\n`;
      msg += `💬 Digite o número do documento desejado:`;

      await sock.sendMessage(sender, { text: msg });
      state.step = 4; // Próximo: selecionar tipo de documento
    } else {
      await sock.sendMessage(sender, {
        text: "❌ Número inválido. Digite o número correspondente ao vínculo desejado."
      });
    }
  }

  async handleStep4(sock, sender, text, state) {
    // Seleção do tipo de documento
    const tipoDocumento = parseInt(text.trim());

    if (tipoDocumento >= 1 && tipoDocumento <= 6) {
      state.data.SSEOperacao = tipoDocumento.toString();

      // Mapear chaves por tipo de documento
      const chaves = {
        1: 'DC', // Demonstrativo
        2: 'CR', // Certidão
        3: 'BC', // BCI
        4: 'BC', // BCM
        5: 'AL', // Alvará
        6: 'VS'  // VISA
      };

      state.data.SSEChave = chaves[tipoDocumento];

      await sock.sendMessage(sender, {
        text: `📝 Gerando ${this.tiposDocumento[tipoDocumento]}... Aguarde um momento.`
      });

      await this.emitirDocumento(sock, sender, state);
    } else {
      await sock.sendMessage(sender, {
        text: "❌ Opção inválida. Digite um número de 1 a 6 para selecionar o tipo de documento."
      });
    }
  }

  async consultarInscricoes(sock, sender, cpfCnpj, state) {
    try {
      state.data.SSECPFCNPJ = cpfCnpj.trim();
      const inscricoes = await this.documentService.consultarInscricoes(
        cpfCnpj.trim()
      );

      if (inscricoes.length > 0) {
        const contribuinte = inscricoes[0].contribuinte; // Dados do contribuinte (mesmo para todos)

        // Contar vínculos por tipo
        const empresas = inscricoes.filter(i => i.tipo === 'EMPRESA');
        const imoveis = inscricoes.filter(i => i.tipo === 'IMÓVEL');
        const totalVinculos = inscricoes.length;

        let msg = `✅ Vínculos encontrados para:\n`;
        msg += `👤 **${contribuinte.nome}**\n`;
        msg += `📄 CPF/CNPJ: ${contribuinte.cpfCnpj}\n\n`;

        // Resumo dos vínculos
        msg += `📊 **Resumo**: ${totalVinculos} vínculo${totalVinculos > 1 ? 's' : ''} encontrado${totalVinculos > 1 ? 's' : ''}\n`;
        if (empresas.length > 0) {
          msg += `   🏢 ${empresas.length} empresa${empresas.length > 1 ? 's' : ''}\n`;
        }
        if (imoveis.length > 0) {
          msg += `   🏠 ${imoveis.length} imóve${imoveis.length > 1 ? 'is' : 'l'}\n`;
        }
        msg += `\n`;

        // Verificar limite de segurança
        const LIMITE_EXIBICAO = 20;
        const vinculos_exibir = inscricoes.slice(0, LIMITE_EXIBICAO);
        const vinculos_ocultos = totalVinculos - LIMITE_EXIBICAO;

        if (totalVinculos > LIMITE_EXIBICAO) {
          msg += `⚠️ **ATENÇÃO**: Por questões de segurança, exibindo apenas os primeiros ${LIMITE_EXIBICAO} vínculos.\n`;
          msg += `📋 Restam ${vinculos_ocultos} vínculo${vinculos_ocultos > 1 ? 's' : ''} não exibido${vinculos_ocultos > 1 ? 's' : ''}, consulte diretamente na Prefeitura.\n\n`;
        }

        // Listar vínculos (limitado a 20)
        vinculos_exibir.forEach((insc, idx) => {
          msg += `${this.numberToEmojis(idx + 1)} **${insc.tipo}**: ${insc.inscricao}\n`;
          if (insc.subtipo) {
            msg += `   🏷️ ${insc.subtipo}\n`;
          }
          if (insc.tipoProprietario) {
            msg += `   👤 Proprietário: ${insc.tipoProprietario}\n`;
          }
          if (insc.endereco) {
            msg += `   📍 ${insc.endereco}\n`;
          }
          if (insc.possuiDebito === 'S') {
            msg += `   ⚠️ Possui débito\n`;
          }
          if (insc.debitoSuspenso === 'S') {
            msg += `   ⏸️ Débito suspenso\n`;
          }
          msg += `\n`;
        });

        if (totalVinculos > LIMITE_EXIBICAO) {
          msg += `⚠️ **${vinculos_ocultos} vínculo${vinculos_ocultos > 1 ? 's' : ''} não exibido${vinculos_ocultos > 1 ? 's' : ''}** - consulte na Prefeitura para ver todos.\n\n`;
        }

        msg += "✅ Consulta concluída com sucesso!\n\n";
        msg += "📄 *Deseja emitir algum documento?*\n\n";
        msg += "1️⃣ - Sim, emitir documento\n";
        msg += "2️⃣ - Não, encerrar atendimento";

        await sock.sendMessage(sender, { text: msg });

        // Armazenar inscrições e ir para próximo step
        state.inscricoes = inscricoes;
        state.step = 2; // Pergunta se quer emitir documento
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
          text: `❌ Não foi possível emitir o documento.\n\n**Motivo:** ${resultado.SSAMensagem || "Erro desconhecido"
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
