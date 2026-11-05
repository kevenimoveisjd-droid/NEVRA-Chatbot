// BOT DE WHATSAPP (canal próprio com Baileys). Rode com: npm start
// Variáveis: WORKER_URL, CANAL_SEGREDO, NUMERO_BOT, PAINEL_SENHA, AUTH_DIR (opcional), PORT (a hospedagem define)
// ATENÇÃO: Baileys não é oficial. O WhatsApp pode bloquear o número a qualquer momento. Use um número só do bot.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as B from "@whiskeysockets/baileys";
import pino from "pino";
import { criarCanal } from "./canal.js";
import { criarPainel } from "./painel.js";
import { atualizar, versaoAtual } from "./atualizador.js";

const PASTA = path.dirname(fileURLToPath(import.meta.url));

// o Baileys muda a forma de exportar entre versões; isto aceita as duas
const lib = B.useMultiFileAuthState ? B : B.default;
const makeWASocket = typeof B.default === "function" ? B.default : (B.default && B.default.default) || B.makeWASocket;
const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } = lib;

const E = process.env;
const WORKER_URL = String(E.WORKER_URL || "").replace(/\/+$/, "");
const NUMERO = String(E.NUMERO_BOT || "").replace(/\D/g, "");
const AUTH_DIR = E.AUTH_DIR || "./auth";
const faltando = ["WORKER_URL", "CANAL_SEGREDO", "NUMERO_BOT", "PAINEL_SENHA"].filter((k) => !E[k]);
if (faltando.length) console.error("ATENÇÃO: faltam variáveis: " + faltando.join(", "));

const st = { status: "iniciando", codigo: "", numero: "", versao: "", logs: [] };
versaoAtual(PASTA).then((v) => { st.versao = v; });
function log(t) {
  const linha = new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" }) + "  " + t;
  console.log(linha); st.logs.push(linha); if (st.logs.length > 60) st.logs.shift();
}

// cérebro = o worker.js. Ele responde, guarda o lead, manda para o CRM e avisa a equipe.
async function cerebro(p) {
  const ctrl = new AbortController();
  const rel = setTimeout(() => ctrl.abort(), 45000);
  try {
    const r = await fetch(WORKER_URL + "/api/canal", { method: "POST", signal: ctrl.signal, headers: { "Content-Type": "application/json", "x-canal-segredo": E.CANAL_SEGREDO || "" }, body: JSON.stringify(p) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error("worker " + r.status + ": " + (j.erro || ""));
    return j;
  } finally { clearTimeout(rel); }
}

let atual = null, conectando = false, tentativas = 0, pedindoCodigo = false, timer = null;
const proxy = {
  sendMessage: (...a) => atual.sendMessage(...a),
  sendPresenceUpdate: (...a) => atual.sendPresenceUpdate(...a),
  readMessages: (...a) => atual.readMessages(...a),
};
const canal = criarCanal({
  sock: proxy, cerebro, log,
  cfg: { limitePorMinuto: Number(E.LIMITE_POR_MINUTO) || 10, limitePorDia: Number(E.LIMITE_POR_DIA) || 250, ignorarAntigasSeg: (Number(E.IGNORAR_ANTIGAS_MIN) || 2) * 60 },
});

async function conectar() {
  if (conectando) return;
  conectando = true; clearTimeout(timer);
  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion().catch(() => ({}));
    const sock = makeWASocket({
      ...(version ? { version } : {}),
      auth: state, logger: pino({ level: "silent" }), browser: Browsers.ubuntu("Chrome"),
      markOnlineOnConnect: false, syncFullHistory: false, generateHighQualityLinkPreview: false,
    });
    atual = sock;
    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("messages.upsert", ({ messages, type }) => { if (type === "notify") for (const m of messages) canal.aoReceber(m); });
    sock.ev.on("connection.update", async (u) => {
      if (sock !== atual) return;
      const { connection, lastDisconnect, qr } = u;
      if (qr && !state.creds.registered && !pedindoCodigo && NUMERO) {
        pedindoCodigo = true;
        try { st.codigo = await sock.requestPairingCode(NUMERO); st.status = "aguardando_pareamento"; log("Código de pareamento gerado. Veja no painel."); }
        catch (e) { log("Não consegui gerar o código: " + (e && e.message)); }
        pedindoCodigo = false;
      }
      if (connection === "open") {
        st.status = "conectado"; st.codigo = ""; tentativas = 0;
        st.numero = String((sock.user && sock.user.id) || "").split(":")[0].split("@")[0];
        log("Conectado ao WhatsApp.");
      }
      if (connection === "close") {
        const code = lastDisconnect && lastDisconnect.error && lastDisconnect.error.output && lastDisconnect.error.output.statusCode;
        st.status = "desconectado"; st.numero = "";
        const parar = [DisconnectReason.loggedOut, DisconnectReason.forbidden, DisconnectReason.connectionReplaced].includes(code);
        if (parar) { log("Desconectado (motivo " + code + "). Não vou reconectar sozinho: veja o painel."); return; }
        const espera = Math.min(60000, 2000 * 2 ** tentativas++);
        log("Conexão caiu (motivo " + code + "). Tentando de novo em " + Math.round(espera / 1000) + "s.");
        timer = setTimeout(conectar, espera);
      }
    });
  } catch (e) {
    log("Erro ao conectar: " + (e && e.message));
    timer = setTimeout(conectar, 15000);
  } finally { conectando = false; }
}

async function desconectar() {
  try { if (atual) await atual.logout(); } catch (e) { /* já estava desconectado */ }
  st.status = "desconectado"; st.codigo = ""; st.numero = ""; log("Número desconectado pelo painel.");
}
async function novoCodigo() {
  try { if (atual) atual.end(undefined); } catch (e) { /* ok */ }
  fs.rmSync(AUTH_DIR, { recursive: true, force: true });
  st.status = "iniciando"; st.codigo = ""; tentativas = 0;
  log("Sessão apagada. Gerando novo código…");
  setTimeout(conectar, 1500);
}

const painel = criarPainel({
  senha: E.PAINEL_SENHA,
  estado: () => ({ ...st, pausado: canal.estado.pausado, recebidas: canal.estado.recebidas, enviadas: canal.estado.enviadas, enviadasHoje: canal.estado.enviadasHoje, ignoradas: canal.estado.ignoradas, erros: canal.estado.erros }),
  acoes: {
    pausar: (v) => { canal.pausar(v); log(v ? "Bot pausado." : "Bot voltou a responder."); },
    desconectar, novoCodigo,
    atualizar: async () => {
      try { return await atualizar({ pasta: PASTA, log, sair: () => process.exit(42) }); }
      catch (e) { log("Falha ao atualizar: " + e.message); return { erro: e.message }; }
    },
  },
});
painel.listen(Number(E.PORT) || 3000, E.HOST || "0.0.0.0", () => log("Painel no ar."));
conectar();
process.on("unhandledRejection", (e) => log("Erro não tratado: " + (e && e.message)));
