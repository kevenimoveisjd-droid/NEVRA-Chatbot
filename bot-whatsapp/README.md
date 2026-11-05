# Bot de WhatsApp (canal próprio com Baileys)

O cérebro (Gemini, tabela, lead, CRM) continua no `worker.js`. Esta pasta é só a ponte: recebe a mensagem do WhatsApp, pergunta ao worker e responde como uma pessoa responderia.

**Aviso:** Baileys não é oficial. O WhatsApp pode bloquear o número a qualquer momento. Use um chip só do bot, nunca o número principal da imobiliária.

## Instalar (tudo pelo celular)

1. **Cloudflare:** troque o `worker.js` pelo novo e crie a variável `CANAL_SEGREDO` (uma frase longa e aleatória).
2. **GitHub:** suba esta pasta `bot-whatsapp` no repositório.
3. **Hospedagem 24h** (Railway, por exemplo): New Project > Deploy from GitHub > escolha o repositório e, em Settings, defina a pasta raiz como `bot-whatsapp`.
4. **Volume:** crie um volume montado em `/data`. Sem ele, a sessão some a cada deploy e você precisa parear de novo.
5. **Variáveis:** `WORKER_URL`, `CANAL_SEGREDO` (igual à do Cloudflare), `NUMERO_BOT` (55 + DDD + número, só dígitos), `PAINEL_SENHA`, `AUTH_DIR=/data/auth`.
6. Gere o domínio público e abra a página. Entre com a senha, e o painel mostra um código de 8 letras.
7. No celular do bot: WhatsApp > Aparelhos conectados > Conectar um aparelho > Conectar com número de telefone > digite o código.

## Para reduzir o risco de bloqueio

- Chip novo e dedicado. Nas primeiras 1 ou 2 semanas, converse de forma normal com poucas pessoas antes de divulgar o número.
- O bot só responde quem escreveu primeiro. Nunca envie mensagem em massa nem aborde cliente frio por aqui.
- O código já faz: ignora grupos, ignora mensagens antigas, marca como lida, "digita" antes de enviar, espera conforme o tamanho do texto, limita 10 envios por minuto e 250 por dia, e respeita PARAR/VOLTAR.
- O painel tem o botão **Pausar o bot** para usar na primeira dúvida.
- Instale só `@whiskeysockets/baileys`. Existem forks com nomes parecidos, e já apareceram pacotes com malware roubando sessão.

## No notebook (Windows), sem precisar mexer nele

- O código fica no GitHub. Você edita pelo celular (app do GitHub ou github.dev) e confirma a alteração (commit).
- O notebook baixa a versão nova sozinho toda vez que o bot liga. Também dá para forçar no painel, no botão **Atualizar o bot**.
- O painel abre no celular pelo Tailscale: instale o app no celular e no notebook, entre com a mesma conta e abra `http://NOME-DO-NOTEBOOK:3000`.
- Nunca suba o arquivo `.env` para o GitHub: ele tem as senhas. O `.gitignore` já o protege, mas não use "Upload files" do site com ele na pasta.
- Os horários de ligar e desligar estão na pasta `agenda-pc`.
