(function () {
  const STORAGE_POSTO = "praiana.posto";
  const STORAGE_OVERRIDES = "praiana.tarifas";
  const STORAGE_FAVORITOS = "praiana.favoritos";

  const state = {
    posto: localStorage.getItem(STORAGE_POSTO) || "itajai",
    busca: "",
    trechoId: null,
    tipo: "integral",
    quantidade: 5,
    idaVolta: false,
    itens: [],
  };

  const els = {
    postos: document.getElementById("postos"),
    rotas: document.getElementById("rotas"),
    busca: document.getElementById("busca"),
    rotaSelecionada: document.getElementById("rota-selecionada"),
    codigo: document.getElementById("codigo-linha"),
    tipos: document.getElementById("tipos"),
    qtd: document.getElementById("qtd"),
    atalhos: document.getElementById("atalhos"),
    idaVolta: document.getElementById("ida-volta"),
    unitario: document.getElementById("unitario"),
    total: document.getElementById("total"),
    carrinho: document.getElementById("carrinho"),
    carrinhoTotal: document.getElementById("carrinho-total"),
    carrinhoValor: document.getElementById("carrinho-valor"),
    limpar: document.getElementById("limpar"),
    vigencia: document.getElementById("vigencia"),
    modal: document.getElementById("modal"),
    tabela: document.getElementById("tabela-tarifas"),
    toast: document.getElementById("toast"),
  };

  function money(value) {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function roundMoney(value) {
    return Math.round(value * 100 + 1e-8) / 100;
  }

  function overrides() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_OVERRIDES) || "{}");
    } catch {
      return {};
    }
  }

  function favoritos() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_FAVORITOS) || "[]");
    } catch {
      return [];
    }
  }

  function tarifaOficial(trecho) {
    const custom = overrides()[trecho.id];
    return typeof custom === "number" ? custom : trecho.tarifa;
  }

  function tarifaUnitaria(trecho) {
    const base = tarifaOficial(trecho);
    if (state.tipo === "estudante") {
      return roundMoney(base * (PRAIANA.estudantePercentual / 100));
    }
    return base;
  }

  function passagens() {
    const qtd = Math.max(1, Number(state.quantidade) || 1);
    return state.idaVolta ? qtd * 2 : qtd;
  }

  function norm(text) {
    return String(text)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function postoNome(id) {
    return PRAIANA.postos.find((p) => p.id === id)?.nome || "";
  }

  function origemDoPosto(nomePosto, origem) {
    if (nomePosto === "Balneário Camboriú") {
      return origem === "Balneário Camboriú" || origem.startsWith("Balneário");
    }
    if (nomePosto === "Florianópolis") {
      return origem === "Florianópolis" || origem.startsWith("Florianópolis");
    }
    return origem === nomePosto;
  }

  function trechosVisiveis() {
    const termo = norm(state.busca.trim());
    const posto = postoNome(state.posto);
    let lista = PRAIANA.trechos.slice();

    if (!termo && state.posto !== "todas") {
      lista = lista.filter((t) => origemDoPosto(posto, t.origem));
    }

    if (termo) {
      lista = lista.filter((t) => {
        const blob = norm(`${t.linha} ${t.origem} ${t.destino} ${t.codigo}`);
        return blob.includes(termo);
      });
    }

    const stars = new Set(favoritos());
    lista.sort((a, b) => {
      const fa = stars.has(a.id) ? 0 : 1;
      const fb = stars.has(b.id) ? 0 : 1;
      if (fa !== fb) return fa - fb;
      if (termo) {
        const score = (t) => {
          const d = norm(t.destino);
          const o = norm(t.origem);
          if (d === termo || o === termo) return 0;
          if (d.startsWith(termo) || o.startsWith(termo)) return 1;
          return 2;
        };
        const sa = score(a);
        const sb = score(b);
        if (sa !== sb) return sa - sb;
      }
      return a.destino.localeCompare(b.destino, "pt-BR");
    });

    return lista;
  }

  function trechoAtual() {
    return PRAIANA.trechos.find((t) => t.id === state.trechoId) || null;
  }

  function calcularAtual() {
    const trecho = trechoAtual();
    if (!trecho) return { unitario: 0, total: 0, qtd: 0 };
    const unitario = tarifaUnitaria(trecho);
    const qtd = passagens();
    return { unitario, qtd, total: roundMoney(unitario * qtd) };
  }

  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => els.toast.classList.remove("show"), 1800);
  }

  function renderPostos() {
    els.postos.innerHTML = PRAIANA.postos
      .map(
        (p) =>
          `<button type="button" class="posto ${
            p.id === state.posto ? "active" : ""
          }" data-posto="${p.id}">${p.nome}</button>`
      )
      .join("");
  }

  function renderRotas() {
    const lista = trechosVisiveis();
    if (!lista.length) {
      els.rotas.innerHTML = `<p class="empty">Nenhuma rota encontrada para este posto/busca.</p>`;
      return;
    }

    const stars = new Set(favoritos());
    els.rotas.innerHTML = lista
      .map((t) => {
        const selected = t.id === state.trechoId ? "selected" : "";
        const star = stars.has(t.id) ? "★" : "☆";
        const titulo =
          state.posto === "todas" || state.busca.trim()
            ? `${t.origem} → ${t.destino}`
            : t.destino;
        return `<button type="button" class="route ${selected}" data-id="${t.id}">
          <div class="route-title">${titulo}</div>
          <div class="route-meta">${t.linha} · ${t.codigo}</div>
          <div class="route-fare">${money(tarifaOficial(t))} <span data-fav="${t.id}">${star}</span></div>
        </button>`;
      })
      .join("");
  }

  function renderCalc() {
    const trecho = trechoAtual();
    if (!trecho) {
      els.rotaSelecionada.textContent = "Selecione uma rota";
      els.codigo.textContent = "—";
      els.unitario.textContent = money(0);
      els.total.textContent = money(0);
      return;
    }

    const calc = calcularAtual();
    els.rotaSelecionada.textContent = `${trecho.origem} → ${trecho.destino}`;
    els.codigo.textContent = trecho.codigo;
    els.unitario.textContent = `${money(calc.unitario)} · ${calc.qtd} ${
      calc.qtd === 1 ? "passagem" : "passagens"
    }`;
    els.total.textContent = money(calc.total);
  }

  function renderCarrinho() {
    if (!state.itens.length) {
      els.carrinho.innerHTML = "";
      els.carrinhoTotal.hidden = true;
      els.limpar.hidden = true;
      return;
    }

    els.carrinho.innerHTML = state.itens
      .map((item, index) => {
        const t = PRAIANA.trechos.find((x) => x.id === item.trechoId);
        return `<div class="cart-item">
          <div>
            <strong>${t.origem} → ${t.destino}</strong>
            <div class="route-meta">${item.qtd} ${
          item.tipo === "estudante" ? "estudante" : "integral"
        }${item.idaVolta ? " · ida e volta" : ""}</div>
          </div>
          <strong>${money(item.subtotal)}</strong>
          <button type="button" data-remove="${index}" aria-label="Remover">✕</button>
        </div>`;
      })
      .join("");

    const soma = roundMoney(state.itens.reduce((acc, i) => acc + i.subtotal, 0));
    els.carrinhoValor.textContent = money(soma);
    els.carrinhoTotal.hidden = false;
    els.limpar.hidden = false;
  }

  function renderAtalhos() {
    [...els.atalhos.querySelectorAll("button")].forEach((btn) => {
      btn.classList.toggle("active", Number(btn.dataset.qtd) === Number(state.quantidade));
    });
  }

  function renderAll() {
    renderPostos();
    renderRotas();
    renderCalc();
    renderCarrinho();
    renderAtalhos();
    els.qtd.value = state.quantidade;
    els.idaVolta.checked = state.idaVolta;
    els.vigencia.textContent = PRAIANA.vigencia;
  }

  function selecionarTrecho(id) {
    state.trechoId = id;
    renderAll();
  }

  els.postos.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-posto]");
    if (!btn) return;
    state.posto = btn.dataset.posto;
    localStorage.setItem(STORAGE_POSTO, state.posto);
    state.trechoId = null;
    renderAll();
  });

  els.rotas.addEventListener("click", (e) => {
    const fav = e.target.closest("[data-fav]");
    if (fav) {
      e.preventDefault();
      e.stopPropagation();
      const id = fav.dataset.fav;
      const list = favoritos();
      const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
      localStorage.setItem(STORAGE_FAVORITOS, JSON.stringify(next));
      renderRotas();
      return;
    }
    const btn = e.target.closest("[data-id]");
    if (!btn) return;
    selecionarTrecho(btn.dataset.id);
  });

  els.busca.addEventListener("input", (e) => {
    state.busca = e.target.value;
    renderRotas();
  });

  els.tipos.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-tipo]");
    if (!btn) return;
    state.tipo = btn.dataset.tipo;
    [...els.tipos.querySelectorAll("button")].forEach((b) =>
      b.classList.toggle("active", b === btn)
    );
    renderCalc();
  });

  document.getElementById("menos").addEventListener("click", () => {
    state.quantidade = Math.max(1, Number(state.quantidade) - 1);
    renderCalc();
    renderAtalhos();
    els.qtd.value = state.quantidade;
  });

  document.getElementById("mais").addEventListener("click", () => {
    state.quantidade = Math.min(999, Number(state.quantidade) + 1);
    renderCalc();
    renderAtalhos();
    els.qtd.value = state.quantidade;
  });

  els.qtd.addEventListener("input", (e) => {
    state.quantidade = Math.max(1, Math.min(999, Number(e.target.value) || 1));
    renderCalc();
    renderAtalhos();
  });

  els.atalhos.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-qtd]");
    if (!btn) return;
    state.quantidade = Number(btn.dataset.qtd);
    els.qtd.value = state.quantidade;
    renderCalc();
    renderAtalhos();
  });

  els.idaVolta.addEventListener("change", (e) => {
    state.idaVolta = e.target.checked;
    renderCalc();
  });

  document.getElementById("add").addEventListener("click", () => {
    const trecho = trechoAtual();
    if (!trecho) {
      toast("Selecione uma rota primeiro");
      return;
    }
    const calc = calcularAtual();
    state.itens.push({
      trechoId: trecho.id,
      qtd: calc.qtd,
      tipo: state.tipo,
      idaVolta: state.idaVolta,
      subtotal: calc.total,
    });
    renderCarrinho();
    toast("Trecho adicionado à recarga");
  });

  document.getElementById("copiar").addEventListener("click", async () => {
    const somaItens = state.itens.reduce((acc, i) => acc + i.subtotal, 0);
    const valor = state.itens.length ? roundMoney(somaItens) : calcularAtual().total;
    const texto = money(valor);
    try {
      await navigator.clipboard.writeText(texto);
      toast(`Copiado: ${texto}`);
    } catch {
      toast(texto);
    }
  });

  els.carrinho.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-remove]");
    if (!btn) return;
    state.itens.splice(Number(btn.dataset.remove), 1);
    renderCarrinho();
  });

  els.limpar.addEventListener("click", () => {
    state.itens = [];
    renderCarrinho();
  });

  function abrirModal() {
    els.tabela.innerHTML = PRAIANA.trechos
      .map((t) => {
        return `<tr>
          <td>${t.codigo} · ${t.linha}</td>
          <td>${t.origem}</td>
          <td>${t.destino}</td>
          <td><input type="number" min="0" step="0.05" data-tarifa="${t.id}" value="${tarifaOficial(
          t
        ).toFixed(2)}" /></td>
        </tr>`;
      })
      .join("");
    els.modal.classList.add("open");
  }

  document.getElementById("btn-settings").addEventListener("click", abrirModal);
  document.getElementById("fechar-modal").addEventListener("click", () => {
    els.modal.classList.remove("open");
  });
  els.modal.addEventListener("click", (e) => {
    if (e.target === els.modal) els.modal.classList.remove("open");
  });

  document.getElementById("salvar-tarifas").addEventListener("click", () => {
    const next = {};
    els.tabela.querySelectorAll("[data-tarifa]").forEach((input) => {
      const original = PRAIANA.trechos.find((t) => t.id === input.dataset.tarifa);
      const value = Number(input.value);
      if (original && value !== original.tarifa) next[original.id] = value;
    });
    localStorage.setItem(STORAGE_OVERRIDES, JSON.stringify(next));
    els.modal.classList.remove("open");
    renderAll();
    toast("Tarifas atualizadas neste computador");
  });

  document.getElementById("restaurar-tarifas").addEventListener("click", () => {
    localStorage.removeItem(STORAGE_OVERRIDES);
    abrirModal();
    renderAll();
    toast("Valores oficiais restaurados");
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") els.modal.classList.remove("open");
  });

  renderAll();
})();
