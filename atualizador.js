// ATUALIZADOR: baixa o código novo do GitHub (git pull) e reinicia o bot. Assim você edita pelo celular no GitHub
// e o notebook se atualiza sozinho, sem AnyDesk e sem Prompt de Comando.
import { exec } from "node:child_process";

const sh = (cmd, cwd, ms = 240000) => new Promise((ok, err) => {
  exec(cmd, { cwd, timeout: ms, windowsHide: true, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } }, (e, so, se) => {
    if (e) err(new Error(String(se || e.message).trim().split("\n").slice(-2).join(" ").slice(0, 300)));
    else ok(String(so).trim());
  });
});

export async function versaoAtual(pasta) {
  try { return await sh("git rev-parse --short HEAD", pasta, 10000); } catch (e) { return ""; }
}

export async function atualizar({ pasta, log, sair }) {
  let antes;
  try { antes = await sh("git rev-parse HEAD", pasta, 10000); }
  catch (e) { throw new Error("Esta pasta não é um clone do GitHub (ou o Git não está instalado)."); }
  await sh("git pull --ff-only", pasta);
  const depois = await sh("git rev-parse HEAD", pasta, 10000);
  if (antes === depois) { log("Atualização: já estava na versão mais recente."); return { mudou: false }; }
  const pacotes = await sh("git diff --name-only " + antes + " " + depois + " -- package.json package-lock.json", pasta, 10000);
  if (pacotes) { log("Instalando dependências novas…"); await sh("npm install --omit=dev --no-audit --no-fund", pasta); }
  log("Atualizado para " + depois.slice(0, 7) + ". Reiniciando o bot…");
  setTimeout(sair, 1500); // o iniciar-bot.cmd percebe o código 42 e liga o bot de novo
  return { mudou: true };
}
