// CANAL DE WHATSAPP: recebe da biblioteca, pergunta ao cérebro (worker) e responde do jeito que uma pessoa responderia.
// Não importa o Baileys de propósito: assim dá para testar com um "sock" falso, sem número de verdade.
// Regras de segurança que este arquivo impõe (para reduzir o risco de bloqueio do número):
//  - só RESPONDE a quem escreveu; não existe nenhum caminho que inicie conversa
//  - só conversa individual (ignora grupos, status e canais)
//  - ignora mensagens antigas (quando reconecta, não responde o que ficou para trás)
//  - marca como lida, "digita" e espera um tempo proporcional ao tamanho do texto
//  - limite de envios por minuto e por dia; passou do limite, não envia
//  - chave geral para pausar o bot

const dormirPadrao = (ms) => new Promise((r) => setTimeout(r, ms));
const aleat = (a, b) => a + Math.random() * (b - a);
const SEM_CONTEUDO = new Set(["protocolMessage", "reactionMessage", "senderKeyDistributionMessage", "messageContextInfo", "pollUpdateMessage"]);

function extrairTexto(msg) {
  const x = msg || {};
  const d = (x.ephemeralMessage && x.ephemeralMessage.message) || (x.viewOnceMessage && x.viewOnceMessage.message) || x;
  return d.conversation
    || (d.extendedTextMessage && d.extendedTextMessage.text)
    || (d.buttonsResponseMessage && d.buttonsResponseMessage.selectedDisplayText)
    || (d.listResponseMessage && d.listResponseMessage.title)
    || "";
}
const temConteudo = (msg) => Object.keys(msg || {}).some((k) => !SEM_CONTEUDO.has(k));

export function criarCanal({ sock, cerebro, cfg = {}, log = () => {}, agora = () => Date.now(), dormir = dormirPadrao }) {
  const c = {
    ignorarAntigasSeg: 120,
    atrasoLeituraMs: [800, 2500],
    atrasoBaseMs: 900, atrasoPorLetraMs: 35, atrasoMaxMs: 6000,
    limitePorMinuto: 10, limitePorDia: 250,
    ...cfg,
  };
  const estado = { pausado: false, recebidas: 0, enviadas: 0, ignoradas: 0, erros: 0, dia: "", enviadasHoje: 0 };
  const recentes = [];
  const filas = new Map();

  function podeEnviar() {
    const t = agora();
    const dia = new Date(t - 3 * 36e5).toISOString().slice(0, 10); // dia no horário de Brasília
    if (estado.dia !== dia) { estado.dia = dia; estado.enviadasHoje = 0; }
    while (recentes.length && t - recentes[0] > 60000) recentes.shift();
    return recentes.length < c.limitePorMinuto && estado.enviadasHoje < c.limitePorDia;
  }
  function contar() { recentes.push(agora()); estado.enviadasHoje++; estado.enviadas++; }
  const mascara = (n) => "…" + String(n).slice(-4);

  async function atender(m, jid, texto) {
    estado.recebidas++;
    if (estado.pausado) { estado.ignoradas++; log("Bot pausado: não respondi " + mascara(jid.split("@")[0])); return; }
    const alt = m.key.remoteJidAlt || ""; // algumas contas vêm como @lid; quando houver, usamos o número real
    const de = String(/@s\.whatsapp\.net$/.test(jid) ? jid : (alt || jid)).replace(/\D/g, "");

    await dormir(aleat(c.atrasoLeituraMs[0], c.atrasoLeituraMs[1]));
    try { await sock.readMessages([m.key]); } catch (e) { /* marcar como lida não é essencial */ }

    const r = await cerebro({ de, nome: m.pushName || "", texto, tipo: texto ? "texto" : "outro", id: m.key.id });
    let n = 0;
    for (const p of (r && r.saida) || []) {
      let tent = 0; // limite por minuto cheio (ex.: muita gente escrevendo ao mesmo tempo): espera a vez, não perde a resposta
      while (!podeEnviar() && estado.enviadasHoje < c.limitePorDia && tent++ < 24) await dormir(5000);
      if (!podeEnviar()) { estado.ignoradas++; log("Limite de envios atingido: parei de responder " + mascara(de)); break; }
      const tam = p.tipo === "imagem" ? 40 : String(p.texto || "").length;
      const ms = Math.min(c.atrasoMaxMs, c.atrasoBaseMs + tam * c.atrasoPorLetraMs) * aleat(0.8, 1.3);
      try { await sock.sendPresenceUpdate("composing", jid); } catch (e) { /* ok */ }
      await dormir(ms);
      try { await sock.sendPresenceUpdate("paused", jid); } catch (e) { /* ok */ }
      if (p.tipo === "imagem") {
        try { await sock.sendMessage(jid, { image: { url: p.link }, caption: p.legenda || "" }); }
        catch (e) { await sock.sendMessage(jid, { text: (p.legenda ? p.legenda + "\n" : "") + p.link }); }
      } else {
        await sock.sendMessage(jid, { text: p.texto });
      }
      contar(); n++;
    }
    log("Respondi " + mascara(de) + " com " + n + " mensagem(ns)");
  }

  function aoReceber(m) {
    const jid = m && m.key && m.key.remoteJid;
    if (!jid || m.key.fromMe || !m.message) return Promise.resolve();
    if (!/@(s\.whatsapp\.net|lid)$/.test(jid)) { estado.ignoradas++; return Promise.resolve(); } // grupos, status e canais: nunca
    const ts = Number(String(m.messageTimestamp || 0)) || 0;
    if (ts && agora() / 1000 - ts > c.ignorarAntigasSeg) { estado.ignoradas++; log("Ignorei mensagem antiga"); return Promise.resolve(); }
    const texto = extrairTexto(m.message).trim();
    if (!texto && !temConteudo(m.message)) return Promise.resolve();
    // uma fila por cliente: as mensagens dele são atendidas em ordem, sem se misturar
    const fila = (filas.get(jid) || Promise.resolve())
      .then(() => atender(m, jid, texto))
      .catch((e) => { estado.erros++; log("Erro ao atender: " + (e && e.message)); });
    filas.set(jid, fila);
    fila.then(() => { if (filas.get(jid) === fila) filas.delete(jid); });
    return fila;
  }

  return { aoReceber, estado, pausar: (v) => { estado.pausado = !!v; } };
}
