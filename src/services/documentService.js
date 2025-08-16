const axios = require("axios");
const soapRequest = require('easy-soap-request');
const xml2js = require('xml2js');

class DocumentService {
  constructor() {
    this.apiUrl = "https://homologacao.abaco.com.br/arapiraca_proj_hml_eagata/servlet/apapidocumento";
    this.soapUrl = "https://homologacao.abaco.com.br/arapiraca_proj_hml_eagata/servlet/apwsretornopertences";
  }

  async consultarInscricoes(cpfCnpj) {
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
    
    try {
      const { response } = await soapRequest({ 
        url: this.soapUrl, 
        headers, 
        xml 
      });
      
      const result = await xml2js.parseStringPromise(response.body, { 
        explicitArray: false 
      });
      
      console.log("Resposta SOAP completa:", JSON.stringify(result, null, 2));
      
      let inscricoes = [];
      try {
        // Verificar estrutura SOAP básica
        if (!result || !result['soapenv:Envelope'] || !result['soapenv:Envelope']['soapenv:Body']) {
          console.error("Estrutura SOAP inválida:", result);
          return inscricoes;
        }

        const response = result['soapenv:Envelope']['soapenv:Body']['PWSRetornoPertences.ExecuteResponse'];
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

        // Extrair inscrições de empresas e imóveis
        items.forEach(item => {
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
                  endereco: empresa.SRPEnderecoEmpresa || '',
                  possuiDebito: empresa.SRPPossuiDebitoEmpresa || 'N'
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
                  tipo: 'IMOVEL',
                  endereco: imovel.SRPEnderecoImovel || '',
                  possuiDebito: imovel.SRPPossuiDebitoImovel || 'N'
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
      const response = await axios.get(this.apiUrl, {
        headers: {
          DadosAPIDocumento: JSON.stringify(dadosDocumento),
        },
      });
      
      return response.data;
    } catch (error) {
      console.error("Erro ao emitir documento:", error);
      throw new Error("Falha na emissão do documento");
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
