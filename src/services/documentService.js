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
      
      let inscricoes = [];
      try {
        const pertences = result['soapenv:Envelope']['soapenv:Body']['ns1:PWSRetornoPertences.ExecuteResponse']['ns1:PWSRetornoPertences.ExecuteResult']['Pertences']['Pertence'];
        if (Array.isArray(pertences)) {
          inscricoes = pertences.map(p => p.Inscricao);
        } else if (pertences) {
          inscricoes = [pertences.Inscricao];
        }
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
