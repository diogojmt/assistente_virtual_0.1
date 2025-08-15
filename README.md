# Chatbot WhatsApp com Node.js e Baileys

Este projeto é um chatbot simples para atendimento via WhatsApp utilizando Node.js e a biblioteca Baileys.

## Como usar localmente

1. Instale as dependências:
   ```bash
   npm install @whiskeysockets/baileys
   ```
2. Execute o bot:
   ```bash
   node index.js
   ```

## Como rodar no Replit

1. Certifique-se de que o arquivo `.replit` está presente com o conteúdo:
   ```
   run = "node index.js"
   language = "nodejs"
   ```
2. Clique em "Run" no Replit para iniciar o bot.

## Observações

- Ao iniciar, será exibido um QR Code no terminal. Escaneie com o WhatsApp para conectar.
- O bot responde automaticamente as mensagens recebidas.
- Personalize as respostas editando o arquivo `index.js`.
- Para produção, recomenda-se utilizar um ambiente seguro e persistente para autenticação.
