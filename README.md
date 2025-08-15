# Chatbot WhatsApp com Node.js e Baileys

Este projeto é um chatbot para atendimento via WhatsApp, que permite ao contribuinte emitir documentos municipais de forma automatizada.

## Funcionalidades

- Menu interativo com os tipos de documentos disponíveis:
  1️⃣ Demonstrativo
  2️⃣ Certidão
  3️⃣ BCI
  4️⃣ BCM
  5️⃣ Alvará de Funcionamento
  6️⃣ VISA
- Fluxo guiado para coleta dos dados necessários e emissão do documento.
- Proteção da chave de acesso via arquivo `.env` (não é enviada ao GitHub).

## Como usar localmente

1. Instale as dependências:
   ```bash
   npm install @whiskeysockets/baileys axios dotenv
   ```
2. Crie um arquivo `.env` na raiz do projeto e adicione sua chave de acesso:
   ```
   SSE_CHAVE=SuaChaveAqui
   ```
3. Execute o bot:
   ```bash
   node index.js
   ```

## Como rodar no Replit

1. Certifique-se de que o arquivo `.replit` está presente com o conteúdo:
   ```
   run = "node index.js"
   language = "nodejs"
   ```
2. Adicione o arquivo `.env` com sua chave de acesso.
3. Clique em "Run" no Replit para iniciar o bot.

## Observações

- Ao iniciar, será exibido um QR Code no terminal. Escaneie com o WhatsApp para conectar.
- O bot irá apresentar um menu com os tipos de documentos disponíveis e guiar o usuário na coleta dos dados.
- A chave de acesso está protegida no arquivo `.env`, que não é enviado ao GitHub.
- Personalize o fluxo e as mensagens editando o arquivo `index.js`.

## Sobre o Baileys

Baileys é uma biblioteca Node.js para integração com o WhatsApp Web, permitindo o envio e recebimento de mensagens, arquivos, imagens e automações diversas sem a necessidade de API oficial.

Repositório oficial: https://github.com/WhiskeySockets/Baileys

Para suporte, dúvidas e exemplos, consulte:

- Issues e Wiki no repositório oficial
- Comunidade no GitHub
- Documentação disponível no próprio repositório
