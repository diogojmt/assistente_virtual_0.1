# Assistente Virtual Municipal – Chatbot WhatsApp com Node.js e Baileys

Este projeto é um exemplo de chatbot para atendimento via WhatsApp, desenvolvido em Node.js utilizando a biblioteca Baileys. Ele automatiza a emissão de documentos municipais, guiando o usuário por um menu interativo e coletando os dados necessários para cada tipo de documento.

## Estrutura do Projeto

```
assistente_virtual_0.1/
│
├── index.js                # Ponto de entrada do bot
├── package.json            # Dependências e scripts
├── README.md               # Documentação do projeto
├── src/
│   ├── bot/
│   │   └── whatsappBot.js      # Lógica de integração com o WhatsApp
│   ├── handlers/
│   │   └── messageHandler.js   # Manipulação das mensagens e fluxo do usuário
│   ├── server/
│   │   └── httpServer.js       # Servidor HTTP (se aplicável)
│   └── services/
│       └── documentService.js  # Lógica de emissão dos documentos
```

## Funcionalidades

- Consulta dos vínculos do usuário com a prefeitura:
  - Empresas e imóveis associados ao CPF/CNPJ informado
  - Detalhes como endereço, tipo, débitos e proprietário
- Proteção da chave de acesso via arquivo `.env`.
- Modularização do código em handlers, serviços e integração com o WhatsApp.
- Fácil personalização do fluxo e das mensagens.

> **Atenção:** Esta versão do bot realiza apenas a consulta dos vínculos do usuário com a prefeitura e apresenta essas informações via WhatsApp. A funcionalidade de emissão de documentos estará disponível em uma segunda versão.

## Instalação e Uso Local

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Crie um arquivo `.env` na raiz do projeto e adicione sua chave de acesso:
   ```
   SSE_CHAVE=SuaChaveAqui
   ```
3. Execute o bot:
   ```bash
   node index.js
   ```

## Execução no Replit

1. Certifique-se de que o arquivo `.replit` está presente com:
   ```
   run = "node index.js"
   language = "nodejs"
   ```
2. Adicione o arquivo `.env` com sua chave de acesso.
3. Clique em "Run" no Replit para iniciar o bot.

## Observações

- Ao iniciar, será exibido um QR Code no terminal. Escaneie com o WhatsApp para conectar.
- O bot apresenta um menu e guia o usuário na coleta dos dados.
- A chave de acesso está protegida no arquivo `.env`, que não é enviado ao GitHub.
- Personalize o fluxo editando os arquivos em `src/handlers` e `src/services`.

## Tecnologias Utilizadas

- Node.js
- Baileys (WhatsApp Web API)
- Axios (requisições HTTP)
- Dotenv (variáveis de ambiente)

## Referências

- [Baileys – Repositório Oficial](https://github.com/WhiskeySockets/Baileys)
- [Documentação Baileys](https://github.com/WhiskeySockets/Baileys#readme)
