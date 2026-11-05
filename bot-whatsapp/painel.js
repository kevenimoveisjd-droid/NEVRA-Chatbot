// PAINEL: página simples para ver se o bot está conectado, pegar o código de pareamento, pausar e desconectar.
// Só funciona com PAINEL_SENHA definida.
import http from "node:http";
import crypto from "node:crypto";

const PAGINA = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<title>Painel do bot</title>
<style>
:root{--fundo:#f0f2f5;--card:#fff;--txt:#111b21;--sub:#667781;--linha:#e9edef;--ok:#00a884;--ruim:#c0392b;--aviso:#b3741e}
@media (prefers-color-scheme:dark){:root{--fundo:#0b141a;--card:#111b21;--txt:#e9edef;--sub:#8696a0;--linha:#222d34;--ok:#25d3a2;--ruim:#ff7b6b;--aviso:#f0b35a}}
*{box-sizing:border-box}body{margin:0;background:var(--fundo);color:var(--txt);font:15px/1.45 "Segoe UI",Helvetica,Arial,sans-serif;padding:max(16px,env(safe-area-inset-top)) 16px max(24px,env(safe-area-inset-bottom))}
main{max-width:520px;margin:0 auto}
h1{font-size:20px;margin:6px 0 14px}
.card{background:var(--card);border-radius:14px;padding:16px;margin-bottom:12px;border:1px solid var(--linha)}
.pilula{display:inline-flex;align-items:center;gap:8px;font-weight:600}.pilula i{width:10px;height:10px;border-radius:50%;background:var(--sub)}
.pilula.ok i{background:var(--ok)}.pilula.ruim i{background:var(--ruim)}.pilula.aviso i{background:var(--aviso)}
.codigo{font:700 34px/1.2 ui-monospace,Menlo,monospace;letter-spacing:.12em;text-align:center;padding:14px 0;user-select:all}
ol{margin:8px 0 0;padding-left:20px;color:var(--sub)}
.num{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center}.num b{display:block;font-size:22px}.num span{color:var(--sub);font-size:13px}
button{font:inherit;width:100%;border:0;border-radius:10px;padding:13px;margin-top:8px;background:var(--ok);color:#fff;font-weight:600;cursor:pointer}
button.sec{background:none;color:var(--txt);border:1px solid var(--linha)}button.perigo{background:none;color:var(--ruim);border:1px solid var(--linha)}
button:focus-visible,input:focus-visible{outline:3px solid #f2b705;outline-offset:2px}
.log{max-height:260px;overflow:auto;font:12.5px/1.5 ui-monospace,Menlo,monospace;color:var(--sub)}.log div{padding:3px 0;border-bottom:1px solid var(--linha)}
#porta{display:none}#porta input{width:100%;border:1px solid var(--linha);background:var(--fundo);color:var(--txt);border-radius:10px;padding:12px;font:inherit;font-size:16px}
.e{color:var(--ruim);min-height:1.3em;margin:8px 0 0}.mudo{color:var(--sub)}
</style></head><body><main>
<h1>Painel do bot de WhatsApp</h1>
<div class="card" id="porta"><b>Senha do painel</b><p class="mudo">É a variável PAINEL_SENHA do servidor.</p><input id="senha" type="password" aria-label="Senha do painel" autocomplete="current-password"><button id="entrar">Entrar</button><p class="e" id="erro" role="alert"></p></div>
<div id="tela" style="display:none">
  <div class="card"><div class="pilula" id="pil"><i></i><span id="stxt">…</span></div><div class="mudo" id="num"></div></div>
  <div class="card" id="cardcod" style="display:none"><b>Conectar o número do bot</b><div class="codigo" id="cod"></div>
    <ol><li>No celular do número do bot, abra o WhatsApp</li><li>Aparelhos conectados &gt; Conectar um aparelho</li><li>Toque em “Conectar com número de telefone” e digite o código</li></ol></div>
  <div class="card"><div class="num"><div><b id="n1">0</b><span>recebidas</span></div><div><b id="n2">0</b><span>enviadas hoje</span></div><div><b id="n3">0</b><span>ignoradas</span></div></div>
    <button id="pausa" class="sec"></button><button id="novo" class="sec">Gerar novo código de pareamento</button><button id="atu" class="sec">Atualizar o bot (baixar a versão nova do GitHub)</button><button id="sair" class="perigo">Desconectar o número</button></div>
  <div class="card"><b>Últimos eventos</b><div class="log" id="log"></div></div>
</div></main>
<script>
(function(){
var senha=localStorage.getItem("painel_senha")||"",$=function(i){return document.getElementById(i)},ult=null;
function api(p,b){return fetch(p,{method:b?"POST":"GET",headers:{"x-senha":senha,"Content-Type":"application/json"},body:b?JSON.stringify(b):undefined}).then(function(r){return r.json().then(function(j){return{s:r.status,j:j}})})}
var TXT={conectado:["ok","Conectado e atendendo"],aguardando_pareamento:["aviso","Aguardando você digitar o código no WhatsApp"],desconectado:["ruim","Desconectado"],iniciando:["aviso","Iniciando…"]};
function mostrar(e){
 ult=e;var t=TXT[e.status]||["aviso",e.status];
 $("pil").className="pilula "+t[0];$("stxt").textContent=e.pausado&&e.status==="conectado"?"Conectado, mas PAUSADO (não responde)":t[1];
 $("num").textContent=(e.numero?"Número: +"+e.numero+"  ·  ":"")+(e.versao?"versão "+e.versao:"");
 $("cardcod").style.display=e.codigo?"block":"none";$("cod").textContent=e.codigo?e.codigo.slice(0,4)+"-"+e.codigo.slice(4):"";
 $("n1").textContent=e.recebidas;$("n2").textContent=e.enviadasHoje;$("n3").textContent=e.ignoradas;
 $("pausa").textContent=e.pausado?"Voltar a responder":"Pausar o bot";
 var l=$("log");l.textContent="";e.logs.slice().reverse().forEach(function(x){var d=document.createElement("div");d.textContent=x;l.appendChild(d)});
}
function ciclo(){api("/api/estado").then(function(x){
 if(x.s===401||x.s===429){$("tela").style.display="none";$("porta").style.display="block";$("erro").textContent=x.s===429?"Muitas tentativas. Espere um minuto.":(senha?"Senha incorreta.":"");return}
 $("porta").style.display="none";$("tela").style.display="block";mostrar(x.j)}).catch(function(){})}
$("entrar").onclick=function(){senha=$("senha").value;localStorage.setItem("painel_senha",senha);ciclo()};
$("senha").onkeydown=function(e){if(e.key==="Enter")$("entrar").click()};
$("pausa").onclick=function(){api("/api/pausar",{pausado:!(ult&&ult.pausado)}).then(ciclo)};
$("novo").onclick=function(){if(confirm("Apagar a sessão atual e gerar um código novo?"))api("/api/novo-codigo",{}).then(ciclo)};
var TXA="Atualizar o bot (baixar a versão nova do GitHub)";
function fimAtu(){$("atu").disabled=false;$("atu").textContent=TXA;ciclo()}
$("atu").onclick=function(){if(!confirm("Baixar a versão nova do GitHub e reiniciar o bot?"))return;$("atu").disabled=true;$("atu").textContent="Atualizando…";api("/api/atualizar",{}).then(fimAtu).catch(function(){setTimeout(fimAtu,8000)})};
$("sair").onclick=function(){if(confirm("Desconectar o número do bot?"))api("/api/desconectar",{}).then(ciclo)};
ciclo();setInterval(ciclo,3000);
})();
</script></body></html>`;

const hash = (s) => crypto.createHash("sha256").update(String(s || "")).digest();

export function criarPainel({ senha, estado, acoes }) {
  const falhas = new Map(); // tentativas erradas por IP
  const bloqueado = (ip) => { const f = falhas.get(ip); return f && f.n >= 10 && Date.now() - f.t < 60000; };
  const errou = (ip) => { const f = falhas.get(ip); const novo = f && Date.now() - f.t < 60000 ? { n: f.n + 1, t: f.t } : { n: 1, t: Date.now() }; falhas.set(ip, novo); };

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    const json = (obj, status) => { res.writeHead(status || 200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); res.end(JSON.stringify(obj)); };
    if (url.pathname === "/saude") { res.writeHead(200); return res.end("ok"); }
    if (url.pathname === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Frame-Options": "DENY" });
      return res.end(PAGINA);
    }
    if (!url.pathname.startsWith("/api/")) { res.writeHead(404); return res.end("Não encontrado"); }
    if (!senha) return json({ erro: "Defina PAINEL_SENHA no servidor." }, 403);
    const ip = req.headers["x-forwarded-for"] ? String(req.headers["x-forwarded-for"]).split(",")[0].trim() : req.socket.remoteAddress;
    if (bloqueado(ip)) return json({ erro: "Muitas tentativas." }, 429);
    if (!crypto.timingSafeEqual(hash(req.headers["x-senha"]), hash(senha))) { errou(ip); return json({ erro: "Senha incorreta." }, 401); }

    if (req.method === "GET" && url.pathname === "/api/estado") return json(estado());
    if (req.method === "POST") {
      let corpo = {};
      try { const partes = []; for await (const p of req) { partes.push(p); if (partes.length > 50) break; } corpo = JSON.parse(Buffer.concat(partes).toString() || "{}"); } catch (e) { /* corpo vazio */ }
      if (url.pathname === "/api/pausar") { acoes.pausar(!!corpo.pausado); return json(estado()); }
      if (url.pathname === "/api/desconectar") { await acoes.desconectar(); return json(estado()); }
      if (url.pathname === "/api/atualizar") { const resultado = await acoes.atualizar(); return json({ ...estado(), resultado }); }
      if (url.pathname === "/api/novo-codigo") { await acoes.novoCodigo(); return json(estado()); }
    }
    return json({ erro: "Rota desconhecida." }, 404);
  });
}
