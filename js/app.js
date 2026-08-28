/* =====================================================================

   Duas APIs são consumidas aqui:
     · a nossa, em C#  (http://localhost:5000/api) — produtos e pedidos
     · a do ViaCEP     (https://viacep.com.br)     — endereço pelo CEP
   ===================================================================== */

const API = "http://localhost:5000/api";
const VIACEP = "https://viacep.com.br/ws";

// mesma regra que a API aplica; aqui é só para mostrar o valor antes
// de fechar a compra. Quem decide o preço final é sempre o servidor.
const FRETE = 24.90;
const FRETE_GRATIS_ACIMA = 299.90;

let produtos = [];
let sacola = [];          // { id_produto, tamanho, quantidade }
let filtroNumero = "todos";

/* ---------------------------------------------------------- atalhos -- */

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

const dinheiro = (n) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// impede que texto vindo do banco quebre o HTML
const esc = (t) =>
  String(t ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const acharProduto = (id) => produtos.find((p) => p.id_produto === Number(id));


const estiloDaCaixa = (p) => {
  const cor = `--cor:${esc(p.cor_hex || "#C7A175")}`;
  return p.imagem ? `${cor};background-image:url('${esc(p.imagem)}')` : cor;
};

function avisar(texto, erro = false) {
  const el = document.createElement("div");
  el.className = "aviso" + (erro ? " aviso--erro" : "");
  el.textContent = texto;
  $("#avisos").append(el);
  setTimeout(() => el.remove(), 3500);
}

/* ---------------------------------------------------------- vitrine -- */

async function carregarProdutos() {
  try {
    const resposta = await fetch(API + "/produtos");
    produtos = await resposta.json();
    mostrarProdutos();
  } catch {
    $("#grade").innerHTML = `
      <div class="vazio">
        <strong>A vitrine não carregou</strong>
        Os produtos vêm do banco pela API. Rode <code>dotnet run</code> dentro
        da pasta <code>api</code> e atualize a página.
      </div>`;
    $("#conta").textContent = "";
  }
}

const totalNaGrade = (p) => p.grade.reduce((s, g) => s + g.quantidade, 0);

const temONumero = (p) =>
  filtroNumero === "todos" ||
  p.grade.some((g) => g.tamanho === filtroNumero && g.quantidade > 0);

function mostrarProdutos() {
  const lista = produtos.filter(temONumero);

  $("#conta").textContent = lista.length
    ? `${lista.length} ${lista.length === 1 ? "modelo" : "modelos"}` +
      (filtroNumero === "todos" ? "" : ` no ${filtroNumero}`)
    : "";

  if (!lista.length) {
    $("#grade").innerHTML = `
      <div class="vazio">
        <strong>Nada no ${esc(filtroNumero)}</strong>
        Esse número esgotou. Escolha outro ali em cima.
      </div>`;
    return;
  }

  $("#grade").innerHTML = lista
    .map((p) => {
      const esgotado = totalNaGrade(p) === 0;
      const numeros = p.grade.filter((g) => g.quantidade > 0).map((g) => g.tamanho);
      return `
      <button class="produto" data-produto="${p.id_produto}">
        <div class="produto__tampa" style="${estiloDaCaixa(p)}">
          <span class="produto__cor">${esc(p.cor || "")}</span>
          ${esgotado ? '<span class="produto__esgotado">esgotado</span>' : ""}
        </div>
        <div class="produto__corpo">
          <span class="produto__nome">${esc(p.nome)}</span>
          <span class="produto__desc">${esc(p.descricao || "")}</span>
          <span class="produto__pe">
            <span class="produto__preco">${dinheiro(p.valor)}</span>
            <span class="produto__nums">${
              numeros.length ? "nº " + numeros.join(" ") : "sem estoque"
            }</span>
          </span>
        </div>
      </button>`;
    })
    .join("");
}

$("#filtro").addEventListener("click", (e) => {
  const botao = e.target.closest(".num");
  if (!botao) return;
  filtroNumero = botao.dataset.num;
  $$("#filtro .num").forEach((b) => b.classList.toggle("num--ativo", b === botao));
  mostrarProdutos();
});

/* ----------------------------------------------------------- janela -- */

function abrirJanela(titulo, html) {
  $("#janelaTitulo").textContent = titulo;
  $("#janelaCorpo").innerHTML = html;
  $("#janela").hidden = false;
  $("#cortina").hidden = false;
}

function fecharJanela() {
  $("#janela").hidden = true;
  $("#cortina").hidden = true;
}

$("#btnFechar").addEventListener("click", fecharJanela);
$("#cortina").addEventListener("click", fecharJanela);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") fecharJanela();
});

/* ------------------------------------------------- ficha do produto -- */

document.addEventListener("click", (e) => {
  const cartao = e.target.closest(".produto");
  if (!cartao) return;
  abrirProduto(acharProduto(cartao.dataset.produto));
});

function abrirProduto(produto) {
  let escolhido = null;

  abrirJanela(
    "Escolha o número",
    `
    <div class="ficha__tampa" style="${estiloDaCaixa(produto)}"></div>
    <div class="ficha__nome">${esc(produto.nome)}</div>
    <p class="ficha__desc">${esc(produto.descricao || "")} · ${esc(produto.cor || "")}</p>
    <p class="ficha__preco">${dinheiro(produto.valor)}</p>

    <p class="rotulo">Numeração disponível</p>
    <div class="tamanhos" id="tamanhos">
      ${produto.grade
        .map(
          (g) => `
        <button class="tamanho" data-tamanho="${esc(g.tamanho)}" ${
            g.quantidade === 0 ? "disabled" : ""
          }>
          ${esc(g.tamanho)}
          <small>${g.quantidade === 0 ? "esgotado" : g.quantidade + " pares"}</small>
        </button>`
        )
        .join("")}
    </div>

    <button class="btn btn--largo" id="btnAdicionar" disabled>Escolha um número</button>`
  );

  $("#tamanhos").addEventListener("click", (e) => {
    const botao = e.target.closest(".tamanho");
    if (!botao || botao.disabled) return;
    escolhido = botao.dataset.tamanho;
    $$("#tamanhos .tamanho").forEach((b) =>
      b.classList.toggle("tamanho--ativo", b === botao)
    );
    $("#btnAdicionar").disabled = false;
    $("#btnAdicionar").textContent = `Adicionar o ${escolhido} à sacola`;
  });

  $("#btnAdicionar").addEventListener("click", () =>
    adicionarNaSacola(produto.id_produto, escolhido)
  );
}

/* ----------------------------------------------------------- sacola -- */

function estoqueDe(id_produto, tamanho) {
  const produto = acharProduto(id_produto);
  return produto?.grade.find((g) => g.tamanho === tamanho)?.quantidade ?? 0;
}

function adicionarNaSacola(id_produto, tamanho) {
  const jaTem = sacola.find((i) => i.id_produto === id_produto && i.tamanho === tamanho);
  const disponivel = estoqueDe(id_produto, tamanho);

  if (jaTem) {
    if (jaTem.quantidade >= disponivel) {
      avisar(`Só temos ${disponivel} no número ${tamanho}.`, true);
      return;
    }
    jaTem.quantidade++;
  } else {
    sacola.push({ id_produto, tamanho, quantidade: 1 });
  }

  atualizarContador();
  avisar(`${acharProduto(id_produto).nome} ${tamanho} na sacola.`);
  abrirSacola();
}

function mudarQuantidade(indice, passo) {
  const item = sacola[indice];
  const nova = item.quantidade + passo;
  const disponivel = estoqueDe(item.id_produto, item.tamanho);

  if (nova < 1) sacola.splice(indice, 1);
  else if (nova > disponivel) {
    avisar(`Só temos ${disponivel} no número ${item.tamanho}.`, true);
    return;
  } else item.quantidade = nova;

  atualizarContador();
  abrirSacola();
}

function contas() {
  const subtotal = sacola.reduce((soma, item) => {
    const produto = acharProduto(item.id_produto);
    return soma + (produto ? produto.valor * item.quantidade : 0);
  }, 0);
  const frete = subtotal === 0 || subtotal >= FRETE_GRATIS_ACIMA ? 0 : FRETE;
  return { subtotal, frete, total: subtotal + frete };
}

function atualizarContador() {
  $("#contador").textContent = sacola.reduce((s, i) => s + i.quantidade, 0);
}

function blocoDeContas() {
  const { subtotal, frete, total } = contas();
  return `
    <div class="conta-final">
      <div><span>Subtotal</span><span>${dinheiro(subtotal)}</span></div>
      <div><span>Frete</span><span class="${frete === 0 ? "gratis" : ""}">${
    frete === 0 ? "grátis" : dinheiro(frete)
  }</span></div>
      ${
        frete > 0
          ? `<div style="color:var(--suave)"><span>faltam ${dinheiro(
              FRETE_GRATIS_ACIMA - subtotal
            )} para o frete grátis</span><span></span></div>`
          : ""
      }
      <div class="total"><span>Total</span><span>${dinheiro(total)}</span></div>
    </div>`;
}

function abrirSacola() {
  if (!sacola.length) {
    abrirJanela(
      "Sua sacola",
      `<div class="vazio"><strong>Ainda está vazia</strong>Escolha um modelo na vitrine.</div>`
    );
    return;
  }

  const itens = sacola
    .map((item, i) => {
      const p = acharProduto(item.id_produto);
      return `
      <div class="item">
        <div class="item__caixa" style="${estiloDaCaixa(p)}"></div>
        <div>
          <div class="item__nome">${esc(p.nome)}</div>
          <div class="item__meta">número ${esc(item.tamanho)}</div>
        </div>
        <div class="item__dir">
          <span class="item__preco">${dinheiro(p.valor * item.quantidade)}</span>
          <span class="qtd">
            <button data-passo="-1" data-i="${i}" aria-label="Tirar">−</button>
            <span>${item.quantidade}</span>
            <button data-passo="1" data-i="${i}" aria-label="Adicionar">+</button>
          </span>
        </div>
      </div>`;
    })
    .join("");

  abrirJanela(
    "Sua sacola",
    itens +
      blocoDeContas() +
      `<button class="btn btn--largo" id="btnFinalizar">Finalizar compra</button>`
  );

  $("#janelaCorpo").addEventListener("click", (e) => {
    const botao = e.target.closest("[data-passo]");
    if (!botao) return;
    mudarQuantidade(Number(botao.dataset.i), Number(botao.dataset.passo));
  });

  $("#btnFinalizar").addEventListener("click", abrirCheckout);
}

$("#btnSacola").addEventListener("click", abrirSacola);

/* --------------------------------------------------------- checkout -- */

function abrirCheckout() {
  abrirJanela(
    "Finalizar compra",
    `
    <form id="formCompra">
      <label class="campo"><span>Nome completo</span>
        <input name="nome" required placeholder="Marina Alvarenga">
      </label>
      <div class="dupla">
        <label class="campo"><span>CPF</span>
          <input name="cpf" required placeholder="000.000.000-00">
        </label>
        <label class="campo"><span>Telefone</span>
          <input name="telefone" placeholder="(31) 98888-0000">
        </label>
      </div>
      <label class="campo"><span>E-mail</span>
        <input type="email" name="email" placeholder="voce@email.com">
      </label>

      <p class="rotulo">Entrega</p>
      <div class="dupla">
        <label class="campo"><span>CEP</span>
          <input name="cep" id="cep" required inputmode="numeric" placeholder="00000-000">
        </label>
        <label class="campo"><span>Número</span>
          <input name="numero" id="numero" placeholder="812">
        </label>
      </div>
      <p class="cep-aviso" id="cepAviso">Digite o CEP e o endereço é preenchido sozinho.</p>

      <label class="campo"><span>Rua</span>
        <input name="logradouro" id="logradouro" readonly>
      </label>
      <label class="campo"><span>Complemento</span>
        <input name="complemento" placeholder="apto, bloco (opcional)">
      </label>
      <div class="tripla">
        <label class="campo"><span>Bairro</span>
          <input name="bairro" id="bairro" readonly>
        </label>
        <label class="campo"><span>Cidade</span>
          <input name="cidade" id="cidade" readonly>
        </label>
        <label class="campo"><span>UF</span>
          <input name="uf" id="uf" readonly>
        </label>
      </div>

      <p class="rotulo">Pagamento</p>
      <label class="campo">
        <select name="forma_pagamento">
          <option value="Pix">Pix — aprovação na hora</option>
          <option value="Cartao de credito">Cartão de crédito</option>
          <option value="Cartao de debito">Cartão de débito</option>
          <option value="Boleto">Boleto</option>
        </select>
      </label>

      ${blocoDeContas()}
      <button class="btn btn--largo" type="submit" id="btnPagar">Confirmar compra</button>
    </form>`
  );

  $("#cep").addEventListener("blur", buscarCep);
  $("#formCompra").addEventListener("submit", enviarCompra);
}

/* --- consulta do ViaCEP: preenche rua, bairro, cidade e UF ------------ */

async function buscarCep() {
  const cep = $("#cep").value.replace(/\D/g, "");
  const aviso = $("#cepAviso");

  if (cep.length !== 8) {
    aviso.className = "cep-aviso";
    aviso.textContent = "O CEP precisa ter 8 dígitos.";
    return;
  }

  aviso.className = "cep-aviso";
  aviso.textContent = "Consultando o ViaCEP…";

  try {
    const resposta = await fetch(`${VIACEP}/${cep}/json/`);
    const dados = await resposta.json();

    // o ViaCEP responde { "erro": true } quando o CEP não existe
    if (dados.erro) {
      aviso.className = "cep-aviso cep-aviso--erro";
      aviso.textContent = "CEP não encontrado. Confira o número.";
      return;
    }

    $("#logradouro").value = dados.logradouro || "";
    $("#bairro").value = dados.bairro || "";
    $("#cidade").value = dados.localidade || "";
    $("#uf").value = dados.uf || "";

    aviso.className = "cep-aviso cep-aviso--ok";
    aviso.textContent = `Endereço preenchido: ${dados.localidade}/${dados.uf}.`;
    $("#numero").focus();
  } catch {
    aviso.className = "cep-aviso cep-aviso--erro";
    aviso.textContent = "Não deu para consultar o ViaCEP. Verifique sua internet.";
  }
}

/* --- envio da compra para a nossa API --------------------------------- */

async function enviarCompra(evento) {
  evento.preventDefault();

  const dados = Object.fromEntries(new FormData(evento.target).entries());
  const botao = $("#btnPagar");

  if (!dados.logradouro) {
    avisar("Preencha o CEP para completar o endereço.", true);
    return;
  }

  botao.disabled = true;
  botao.textContent = "Enviando…";

  try {
    const resposta = await fetch(API + "/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cliente: {
          nome: dados.nome,
          cpf: dados.cpf,
          email: dados.email,
          telefone: dados.telefone,
          cep: dados.cep,
          logradouro: dados.logradouro,
          numero: dados.numero,
          complemento: dados.complemento,
          bairro: dados.bairro,
          cidade: dados.cidade,
          uf: dados.uf,
        },
        forma_pagamento: dados.forma_pagamento,
        itens: sacola,
      }),
    });

    const recibo = await resposta.json();
    if (!resposta.ok) throw new Error(recibo.erro || "Não foi possível concluir.");

    sacola = [];
    atualizarContador();
    await carregarProdutos();     // o estoque mudou
    mostrarRecibo(recibo, dados.cpf);
  } catch (erro) {
    avisar(erro.message, true);
    botao.disabled = false;
    botao.textContent = "Tentar de novo";
  }
}

function mostrarRecibo(recibo, cpf) {
  abrirJanela(
    "Compra concluída",
    `<div class="ok">
      <div class="ok__selo">✓</div>
      <h4>${recibo.pago ? "Pagamento aprovado" : "Pedido registrado"}</h4>
      <p class="ok__num">PEDIDO ${String(recibo.id_pedido).padStart(4, "0")}</p>
      <p>${
        recibo.pago
          ? "Já vamos separar suas caixas. Obrigada pela compra!"
          : "Assim que o pagamento for confirmado, separamos suas caixas."
      }</p>
      <div class="conta-final" style="text-align:left">
        <div><span>Subtotal</span><span>${dinheiro(recibo.subtotal)}</span></div>
        <div><span>Frete</span><span class="${recibo.frete === 0 ? "gratis" : ""}">${
      recibo.frete === 0 ? "grátis" : dinheiro(recibo.frete)
    }</span></div>
        <div class="total"><span>Total</span><span>${dinheiro(recibo.valor_total)}</span></div>
      </div>
      <p class="ok__num" style="margin-top:14px">
        Acompanhe pelo CPF ${esc(cpf)} em "Meus pedidos".
      </p>
      <button class="btn btn--largo" id="btnOk">Fechar</button>
    </div>`
  );
  $("#btnOk").addEventListener("click", fecharJanela);
}

/* ----------------------------------------------------- meus pedidos -- */

$("#formConsulta").addEventListener("submit", async (evento) => {
  evento.preventDefault();

  const cpf = new FormData(evento.target).get("cpf").trim();
  const area = $("#listaPedidos");
  area.innerHTML = `<div class="vazio">Procurando…</div>`;

  const situacao = (t) =>
    "situacao situacao--" +
    String(t || "").toLowerCase().normalize("NFD").replace(/[^a-z]/g, "");

  try {
    const resposta = await fetch(API + "/pedidos?cpf=" + encodeURIComponent(cpf));
    const pedidos = await resposta.json();

    if (!resposta.ok) throw new Error(pedidos.erro || "Não foi possível consultar.");

    if (!pedidos.length) {
      area.innerHTML = `<div class="vazio">
        <strong>Nenhum pedido nesse CPF</strong>
        Digite com os pontos e o traço, como no cadastro.
      </div>`;
      return;
    }

    area.innerHTML = pedidos
      .map(
        (p) => `
      <article class="pedido">
        <div class="pedido__topo">
          <strong>Pedido ${String(p.id_pedido).padStart(4, "0")}</strong>
          <span>${esc(p.data_pedido)}</span>
          <span class="${situacao(p.status_pedido)}">${esc(p.status_pedido)}</span>
          <span class="${situacao(p.status_pagamento)}">${esc(
          p.forma_pagamento || "—"
        )} · ${esc(p.status_pagamento || "—")}</span>
        </div>
        <ul>
          ${p.itens
            .map(
              (i) =>
                `<li>${i.quantidade}× ${esc(i.produto)} · número ${esc(
                  i.tamanho
                )} — ${dinheiro(i.valor_unitario * i.quantidade)}</li>`
            )
            .join("")}
        </ul>
        <div class="pedido__total">
          <span>frete ${p.valor_frete === 0 ? "grátis" : dinheiro(p.valor_frete)}</span>
          <span>total ${dinheiro(p.valor_total)}</span>
        </div>
      </article>`
      )
      .join("");
  } catch (erro) {
    area.innerHTML = `<div class="vazio"><strong>Não deu para consultar</strong>${esc(
      erro.message
    )}</div>`;
  }
});

/* --------------------------------------------------------- máscaras -- */

document.addEventListener("input", (e) => {
  const campo = e.target;

  if (campo.name === "cpf") {
    const so = campo.value.replace(/\D/g, "").slice(0, 11);
    campo.value = so
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
  }

  if (campo.name === "telefone") {
    const so = campo.value.replace(/\D/g, "").slice(0, 11);
    campo.value = so.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
  }

  if (campo.name === "cep") {
    const so = campo.value.replace(/\D/g, "").slice(0, 8);
    campo.value = so.replace(/(\d{5})(\d)/, "$1-$2");
    if (so.length === 8) buscarCep();   // busca assim que completa
  }
});

/* ----------------------------------------------------------- início -- */

atualizarContador();
carregarProdutos();
