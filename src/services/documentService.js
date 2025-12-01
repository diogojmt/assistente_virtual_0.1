const axios = require("axios");
const soapRequest = require('easy-soap-request');
const xml2js = require('xml2js');

class DocumentService {
  constructor() {
    this.apiUrl = "https://homologacao.abaco.com.br/arapiraca_proj_hml_eagata/servlet/apapidocumento";
    this.soapUrl = "https://homologacao.abaco.com.br/arapiraca_proj_hml_eagata/servlet/apwsretornopertences";
  }

  // Normaliza CPF/CNPJ removendo pontos, traços e barras
  normalizarCpfCnpj(cpfCnpj) {
    return cpfCnpj.replace(/[.\-\/]/g, '').trim();
  }

  async consultarInscricoes(cpfCnpj) {
    // Normalizar CPF/CNPJ removendo formatação
    const cpfCnpjNormalizado = this.normalizarCpfCnpj(cpfCnpj);

    const xml = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:eag="eAgata_Arapiraca_Maceio_Ev3">
   <soapenv:Header/>
   <soapenv:Body>
      <eag:PWSRetornoPertences.Execute>
         <eag:Flagtipopesquisa>C</eag:Flagtipopesquisa>
         <eag:Ctgcpf>${cpfCnpjNormalizado}</eag:Ctgcpf>
         <eag:Ctiinscricao></eag:Ctiinscricao>
      </eag:PWSRetornoPertences.Execute>
   </soapenv:Body>
</soapenv:Envelope>`;

    const headers = {
      'Content-Type': 'text/xml;charset=UTF-8',
      'soapAction': ''
    };

    try {
      console.log("Enviando requisição SOAP para:", this.soapUrl);
      console.log("XML da requisição:", xml);

      const { response } = await soapRequest({
        url: this.soapUrl,
        headers,
        xml
      });

      console.log("Status da resposta:", response.statusCode);
      console.log("Headers da resposta:", response.headers);
      console.log("Body da resposta (raw):", response.body);

      if (!response.body || typeof response.body !== 'string') {
        console.error("Resposta inválida ou vazia:", response.body);
        return [];
      }

      const result = await xml2js.parseStringPromise(response.body, {
        explicitArray: false
      });

      console.log("Resposta SOAP completa:", JSON.stringify(result, null, 2));

      let inscricoes = [];
      try {
        // Verificar estrutura SOAP básica - considerar ambos os namespaces
        const envelope = result['soapenv:Envelope'] || result['SOAP-ENV:Envelope'];
        const body = envelope ? (envelope['soapenv:Body'] || envelope['SOAP-ENV:Body']) : null;

        if (!envelope || !body) {
          console.error("Estrutura SOAP inválida:", result);
          return inscricoes;
        }

        const response = body['PWSRetornoPertences.ExecuteResponse'];
        if (!response || !response.Sdtretornopertences) {
          console.log("Nenhum resultado encontrado para o CPF/CNPJ");
          return inscricoes;
        }

        const retornoItems = response.Sdtretornopertences['SDTRetornoPertences.SDTRetornoPertencesItem'];
        if (!retornoItems) {
          return inscricoes;
        }

        // Normalizar para array se vier um único item
        const items = Array.isArray(retornoItems) ? retornoItems : [retornoItems];

        // Extrair informações do contribuinte e vínculos
        items.forEach(item => {
          // Verificar se CPF/CNPJ é válido
          if (item.SRPCPFCNPJInvalido === 'S') {
            throw new Error('CPF/CNPJ inválido');
          }

          const contribuinte = {
            nome: item.SRPNomeContribuinte || '',
            cpfCnpj: item.SRPCPFCNPJContribuinte || '',
            codigoContribuinte: item.SRPCodigoContribuinte || ''
          };

          // Empresas
          if (item.SDTRetornoPertencesEmpresa && item.SDTRetornoPertencesEmpresa.SDTRetornoPertencesEmpresaItem) {
            const empresas = Array.isArray(item.SDTRetornoPertencesEmpresa.SDTRetornoPertencesEmpresaItem)
              ? item.SDTRetornoPertencesEmpresa.SDTRetornoPertencesEmpresaItem
              : [item.SDTRetornoPertencesEmpresa.SDTRetornoPertencesEmpresaItem];

            empresas.forEach(empresa => {
              if (empresa.SRPInscricaoEmpresa) {
                inscricoes.push({
                  inscricao: empresa.SRPInscricaoEmpresa,
                  tipo: 'EMPRESA',
                  subtipo: empresa.SRPAutonomo === 'A' ? 'AUTÔNOMO' : 'EMPRESA',
                  endereco: empresa.SRPEnderecoEmpresa || '',
                  possuiDebito: empresa.SRPPossuiDebitoEmpresa || 'N',
                  debitoSuspenso: empresa.SRPDebitoSuspensoEmpresa || 'N',
                  contribuinte
                });
              }
            });
          }

          // Imóveis
          if (item.SDTRetornoPertencesImovel && item.SDTRetornoPertencesImovel.SDTRetornoPertencesImovelItem) {
            const imoveis = Array.isArray(item.SDTRetornoPertencesImovel.SDTRetornoPertencesImovelItem)
              ? item.SDTRetornoPertencesImovel.SDTRetornoPertencesImovelItem
              : [item.SDTRetornoPertencesImovel.SDTRetornoPertencesImovelItem];

            imoveis.forEach(imovel => {
              if (imovel.SRPInscricaoImovel) {
                inscricoes.push({
                  inscricao: imovel.SRPInscricaoImovel,
                  tipo: 'IMÓVEL',
                  subtipo: imovel.SRPTipoImovel || '',
                  endereco: imovel.SRPEnderecoImovel || '',
                  possuiDebito: imovel.SRPPossuiDebitoImovel || 'N',
                  debitoSuspenso: imovel.SRPDebitoSuspensoImovel || 'N',
                  tipoProprietario: imovel.SRPTipoProprietario || '',
                  contribuinte
                });
              }
            });
          }
        });

      } catch (e) {
        console.error("Erro ao parsear inscrições:", e);
      }

      return inscricoes;
    } catch (error) {
      console.error("Erro na consulta SOAP:", error);
      throw new Error("Falha na consulta de inscrições");
    }
  }

  async emitirDocumento(dadosDocumento) {
    try {
      console.log("📄 Emitindo documento com dados:", JSON.stringify(dadosDocumento, null, 2));
      console.log("🌐 URL da API:", this.apiUrl);

      const response = await axios.get(this.apiUrl, {
        headers: {
          DadosAPIDocumento: JSON.stringify(dadosDocumento),
        },
      });

      console.log("✅ Resposta da API:", JSON.stringify(response.data, null, 2));
      console.log("📊 Status HTTP:", response.status);

      return response.data;
    } catch (error) {
      console.error("❌ Erro ao emitir documento:", error);
      console.error("📋 Dados enviados:", JSON.stringify(dadosDocumento, null, 2));

      if (error.response) {
        console.error("📡 Status da resposta:", error.response.status);
        console.error("📄 Dados da resposta:", JSON.stringify(error.response.data, null, 2));
        throw new Error(`Falha na emissão: ${error.response.data.SSAMensagem || error.response.statusText || 'Erro desconhecido'}`);
      }

      throw new Error(`Falha na emissão do documento: ${error.message}`);
    }
  }

  prepararDadosDocumento(operacao, chave, tipoContribuinte, inscricao, cpfCnpj = "") {
    return {
      SSEOperacao: operacao,
      SSEChave: chave,
      SSETipoContribuinte: tipoContribuinte,
      SSEInscricao: inscricao,
      SSECPFCNPJ: cpfCnpj,
      SSEExercicioDebito: "",
      SSETipoConsumo: "",
      SSENossoNumero: "",
      SSEIdentificador: "",
    };
  }
}

module.exports = DocumentService;
