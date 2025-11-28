const DocumentService = require("../services/documentService");

class MessageHandler {
  constructor() {
    this.documentService = new DocumentService();
    this.userStates = {};
    this.greetedUsers = {};
    this.invalidWarned = {};
    this.justWelcomed = {};
    this.tipoContribuinteWarned = {};
  }

  // Retorna documentos disponíveis por tipo de vínculo
  getDocumentosDisponiveis(tipoVinculo) {
    if (tipoVinculo === 'IMÓVEL') {
      return [
        { id: 1, nome: "Demonstrativo" },
        { id: 2, nome: "Certidão" },
        { id: 3, nome: "BCI (Boletim de Cadastro Imobiliário)" }
      ];
    } else if (tipoVinculo === 'EMPRESA') {
      return [
        { id: 1, nome: "Demonstrativo" },
        { id: 2, nome: "Certidão" },
        { id: 3, nome: "BCM (Boletim de Cadastro Mercantil)" },
        { id: 4, nome: "Alvará de Funcionamento" },
        { id: 5, nome: "VISA" }
      ];
    }
    // Fallback para todos
    return [
      { id: 1, nome: "Demonstrativo" },
      { id: 2, nome: "Certidão" },
      { id: 3, nome: "BCI (Boletim de Cadastro Imobiliário)" },
      { id: 4, nome: "BCM (Boletim de Cadastro Mercantil)" },
      { id: 5, nome: "Alvará de Funcionamento" },
      { id: 6, nome: "VISA" }
    ];
  }

  // Converte número para emojis (ex: 10 -> 1️⃣0️⃣)
  numberToEmojis(num) {
    const emojiMap = {
      '0': '0️⃣', '1': '1️⃣', '2': '2️⃣', '3': '3️⃣', '4': '4️⃣',
      '5': '5️⃣', '6': '6️⃣', '7': '7️⃣', '8': '8️⃣', '9': '9️⃣'
    };
    return num.toString().split('').map(digit => emojiMap[digit]).join('');
  }

  // Normaliza formatação de endereços (garante que termine com estado se disponível)
  normalizarEndereco(endereco) {
    if (!endereco) return '';

    // Remove espaços extras e barras duplicadas
    let enderecoNorm = endereco.trim().replace(/\/+$/, '');

    // Se não termina com /AL, /PE, etc (2 letras maiúsculas), adiciona /AL como padrão
    if (!/\/[A-Z]{2}$/.test(enderecoNorm)) {
      enderecoNorm += '/AL';
    }

    return enderecoNorm;
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
      case 5:
        await this.handleStep5(sock, sender, text, state);
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
          const enderecoNorm = this.normalizarEndereco(insc.endereco);
          msg += ` - ${enderecoNorm.substring(0, 50)}${enderecoNorm.length > 50 ? '...' : ''}`;
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

      // Obter documentos disponíveis para o tipo de vínculo
      const documentosDisponiveis = this.getDocumentosDisponiveis(inscricaoSelecionada.tipo);
      state.data.documentosDisponiveis = documentosDisponiveis;

      // Mostrar menu de tipos de documento
      let msg = `📄 *Vínculo selecionado:*\n`;
      msg += `${inscricaoSelecionada.tipo}: ${inscricaoSelecionada.inscricao}\n`;

      // Avisar sobre débitos
      if (inscricaoSelecionada.possuiDebito === 'S') {
        msg += `\n⚠️ *ATENÇÃO:* Este vínculo possui débito. Alguns documentos podem não ser emitidos.\n`;
      }

      msg += `\n*Selecione o tipo de documento:*\n\n`;

      documentosDisponiveis.forEach(doc => {
        msg += `${this.numberToEmojis(doc.id)} - ${doc.nome}\n`;
      });

      msg += `\n💬 Digite o número do documento desejado:`;

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

    // Verificar se o documento está disponível para este tipo de vínculo
    const documentosDisponiveis = state.data.documentosDisponiveis || [];
    const docDisponivel = documentosDisponiveis.find(doc => doc.id === tipoDocumento);

    if (!docDisponivel) {
      const tipoVinculo = state.data.inscricaoSelecionada.tipo;
      let mensagemErro = `❌ Este documento não está disponível para vínculos do tipo ${tipoVinculo}.\n\n`;

      if (tipoDocumento > 3 && tipoVinculo === 'IMÓVEL') {
        mensagemErro += `ℹ️ Este documento só pode ser emitido para EMPRESAS.\n\n`;
      }

      mensagemErro += `Documentos disponíveis:\n`;
      documentosDisponiveis.forEach(doc => {
        mensagemErro += `${this.numberToEmojis(doc.id)} - ${doc.nome}\n`;
      });

      await sock.sendMessage(sender, { text: mensagemErro });
      return;
    }

    if (tipoDocumento >= 1 && tipoDocumento <= 5) {
      // Mapear número do menu para código da API e chave
      // Menu EMPRESA: 1=Demo, 2=Certidão, 3=BCM, 4=Alvará, 5=VISA
      // API espera: 1=Demo, 2=Certidão, 4=BCM, 5=Alvará, 6=VISA
      const tipoVinculo = state.data.inscricaoSelecionada.tipo;
      let operacaoAPI = '';
      let chave = '';

      if (tipoVinculo === 'EMPRESA') {
        const mapeamentoEmpresa = {
          1: { operacao: '1', chave: 'DC' }, // Demonstrativo
          2: { operacao: '2', chave: 'CR' }, // Certidão
          3: { operacao: '4', chave: 'BC' }, // BCM (API usa código 4)
          4: { operacao: '5', chave: 'AL' }, // Alvará (API usa código 5)
          5: { operacao: '6', chave: 'VS' }  // VISA (API usa código 6)
        };
        operacaoAPI = mapeamentoEmpresa[tipoDocumento].operacao;
        chave = mapeamentoEmpresa[tipoDocumento].chave;
      } else if (tipoVinculo === 'IMÓVEL') {
        const mapeamentoImovel = {
          1: { operacao: '1', chave: 'DC' }, // Demonstrativo
          2: { operacao: '2', chave: 'CR' }, // Certidão
          3: { operacao: '3', chave: 'BC' }  // BCI (API usa código 3)
        };
        operacaoAPI = mapeamentoImovel[tipoDocumento].operacao;
        chave = mapeamentoImovel[tipoDocumento].chave;
      }

      state.data.SSEOperacao = operacaoAPI;
      state.data.SSEChave = chave;

      // Nome do documento baseado no tipo e vínculo
      const nomeDocumento = docDisponivel.nome;

      await sock.sendMessage(sender, {
        text: `📝 Gerando ${nomeDocumento}... Aguarde um momento.`
      });

      await this.emitirDocumento(sock, sender, state);
    } else {
      await sock.sendMessage(sender, {
        text: "❌ Opção inválida. Digite um número válido para selecionar o tipo de documento."
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
            msg += `   📍 ${this.normalizarEndereco(insc.endereco)}\n`;
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

      // SSACodigo === 0 indica sucesso
      if (resultado.SSACodigo === 0 && resultado.SSALinkDocumento) {
        // Buscar nome do documento
        const docDisponivel = state.data.documentosDisponiveis.find(
          doc => doc.id === parseInt(state.data.SSEOperacao)
        );
        const nomeDoc = docDisponivel ? docDisponivel.nome : 'Documento';

        await sock.sendMessage(sender, {
          text: `🎉 *${nomeDoc}* gerado com sucesso!\n\n📄 **Link do documento:** ${resultado.SSALinkDocumento}\n\n✅ Status: ${resultado.SSAMensagem}\n\n_Clique no link acima para visualizar/baixar seu documento._`,
        });

        // Mostrar menu pós-emissão
        await this.mostrarMenuPosEmissao(sock, sender, state);
      } else {
        // SSACodigo !== 0 indica erro
        const docDisponivel = state.data.documentosDisponiveis.find(
          doc => doc.id === parseInt(state.data.SSEOperacao)
        );
        const nomeDoc = docDisponivel ? docDisponivel.nome : 'documento';

        await sock.sendMessage(sender, {
          text: `❌ Não foi possível emitir o ${nomeDoc}.\n\n**Motivo:** ${resultado.SSAMensagem || "Erro desconhecido"}\n\nTente novamente ou entre em contato com o suporte.`,
        });

        // Mostrar menu pós-emissão mesmo em caso de erro
        await this.mostrarMenuPosEmissao(sock, sender, state);
      }
    } catch (error) {
      await sock.sendMessage(sender, {
        text: `Erro ao consultar documento: ${error.message}`,
      });
      delete this.userStates[sender];
    }
  }

  async mostrarMenuPosEmissao(sock, sender, state) {
    const msg = `\n📋 *O que deseja fazer agora?*\n\n` +
      `1️⃣ - Emitir outro documento (mesmo vínculo)\n` +
      `2️⃣ - Consultar outro CPF/CNPJ\n` +
      `3️⃣ - Encerrar atendimento`;

    await sock.sendMessage(sender, { text: msg });
    state.step = 5; // Menu pós-emissão
  }

  async handleStep5(sock, sender, text, state) {
    const opcao = parseInt(text.trim());

    if (opcao === 1) {
      // Emitir outro documento para o mesmo vínculo
      const inscricaoSelecionada = state.data.inscricaoSelecionada;
      const documentosDisponiveis = state.data.documentosDisponiveis || this.getDocumentosDisponiveis(inscricaoSelecionada.tipo);

      let msg = `📄 *Vínculo selecionado:*\n`;
      msg += `${inscricaoSelecionada.tipo}: ${inscricaoSelecionada.inscricao}\n`;

      // Avisar sobre débitos
      if (inscricaoSelecionada.possuiDebito === 'S') {
        msg += `\n⚠️ *ATENÇÃO:* Este vínculo possui débito. Alguns documentos podem não ser emitidos.\n`;
      }

      msg += `\n*Selecione o tipo de documento:*\n\n`;

      documentosDisponiveis.forEach(doc => {
        msg += `${this.numberToEmojis(doc.id)} - ${doc.nome}\n`;
      });

      msg += `\n💬 Digite o número do documento desejado:`;

      await sock.sendMessage(sender, { text: msg });
      state.step = 4; // Voltar para seleção de tipo de documento

    } else if (opcao === 2) {
      // Nova consulta de CPF/CNPJ
      await sock.sendMessage(sender, {
        text: "📋 Digite o CPF ou CNPJ para consultar os vínculos:"
      });

      // Resetar estado mas manter usuário saudado
      state.step = 1;
      state.data = {};
      state.inscricoes = [];

    } else if (opcao === 3) {
      // Encerrar atendimento
      await sock.sendMessage(sender, {
        text: "👋 Atendimento encerrado. Obrigado por utilizar nosso serviço!\n\nSe precisar de algo, é só me chamar novamente."
      });
      delete this.userStates[sender];

    } else {
      await sock.sendMessage(sender, {
        text: "❌ Opção inválida. Digite 1, 2 ou 3."
      });
    }
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
