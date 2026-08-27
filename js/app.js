(function () {
  const STORAGE_POSTO = "praiana.posto";
  const STORAGE_OVERRIDES = "praiana.tarifas";
  const STORAGE_FAVORITOS = "praiana.favoritos";

  const state = {
    posto: localStorage.getItem(STORAGE_POSTO) || "itajai",
    busca: "",
    trechoId: null,
    tipo: "integral",
    valor: 50,
    idaVolta: false,
  };

  const els = {
    postos: document.getElementById("postos"),
    rotas: document.getElementById("rotas"),
    busca: document.getElementById("busca"),
    rotaSelecionada: document.getElementById("rota-selecionada"),
    codigo: document.getElementById("codigo-linha"),
    tipos: document.getElementById("tipos"),
    valor: document.getElementById("valor"),
    atalhos: document.getElementById("atalhos"),
    idaVolta: document.getElementById("ida-volta"),
    unitario: document.getElementById("unitario"),
    total: document.getElementById("total"),
    detalhe: document.getElementById("detalhe"),
    proximo: document.getElementById("proximo"),
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

  function parseMoney(raw) {
    const s = String(raw).trim().replace(/\s/g, "");
    if (!s) return 0;
    if (s.includes(",") && s.includes(".")) {
      return Number(s.replace(/\./g, "").replace(",", ".")) || 0;
    }
    if (s.includes(",")) return Number(s.replace(",", ".")) || 0;
    return Number(s) || 0;
  }

  function formatInput(value) {
    return value.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
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

  function custoPorViagem(unitario) {
    return state.idaVolta ? roundMoney(unitario * 2) : unitario;
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

  function rotuloUnidade(qtd) {
    if (state.idaVolta) {
      return qtd === 1 ? "ida e volta" : "idas e voltas";
    }
    return qtd === 1 ? "passagem" : "passagens";
  }

  function calcularTrecho(trecho) {
    const valor = Math.max(0, roundMoney(state.valor));
    if (!trecho) {
      return { unitario: 0, custo: 0, qtd: 0, usado: 0, sobra: valor, falta: 0 };
    }

    const unitario = tarifaUnitaria(trecho);
    const custo = custoPorViagem(unitario);

    if (custo <= 0) {
      return { unitario, custo, qtd: Infinity, usado: 0, sobra: valor, falta: 0 };
    }

    const qtd = Math.floor((valor + 1e-8) / custo);
    const usado = roundMoney(qtd * custo);
    const sobra = roundMoney(valor - usado);
    const falta = roundMoney(custo - sobra);
    return { unitario, custo, qtd, usado, sobra, falta };
  }

  function calcularAtual() {
    return calcularTrecho(trechoAtual());
  }

  function textoResultado(calc) {
    if (!Number.isFinite(calc.qtd)) {
      return "Tarifa zero — não desconta passagem";
    }
    const unidade = rotuloUnidade(calc.qtd);
    let texto = `${calc.qtd} ${unidade}`;
    if (calc.qtd > 0) texto += ` · usa ${money(calc.usado)}`;
    if (calc.sobra > 0) texto += ` · sobra ${money(calc.sobra)}`;
    return texto;
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
        const calc = calcularTrecho(t);
        const qtdLabel = Number.isFinite(calc.qtd)
          ? `${calc.qtd} ${rotuloUnidade(calc.qtd)}`
          : "Tarifa zero";
        const extra = Number.isFinite(calc.qtd)
          ? calc.sobra > 0
            ? `sobra ${money(calc.sobra)}`
            : "fecha certinho"
          : "";
        return `<button type="button" class="route ${selected}" data-id="${t.id}">
          <div class="route-title">${titulo}</div>
          <div class="route-meta">${t.linha} · ${t.codigo} · ${money(tarifaOficial(t))}</div>
          <div class="route-passagens">${qtdLabel}<small>${extra} <span data-fav="${t.id}">${star}</span></small></div>
        </button>`;
      })
      .join("");
  }

  function renderCalc() {
    const trecho = trechoAtual();
    const calc = calcularAtual();

    if (!trecho) {
      els.rotaSelecionada.textContent = "Selecione uma rota";
      els.codigo.textContent = "—";
      els.unitario.textContent = money(0);
      els.total.textContent = "0";
      els.detalhe.textContent = "Selecione uma rota e informe o valor";
      els.proximo.textContent = "";
      return;
    }

    els.rotaSelecionada.textContent = `${trecho.origem} → ${trecho.destino}`;
    els.codigo.textContent = trecho.codigo;
    els.unitario.textContent = state.idaVolta
      ? `${money(calc.unitario)} · ida e volta ${money(calc.custo)}`
      : money(calc.unitario);

    if (!Number.isFinite(calc.qtd)) {
      els.total.textContent = "∞";
      els.detalhe.textContent = "Esta linha é tarifa zero.";
      els.proximo.textContent = "";
      return;
    }

    els.total.textContent = String(calc.qtd);
    els.detalhe.textContent = textoResultado(calc);

    if (calc.qtd === 0) {
      els.proximo.textContent = `Faltam ${money(calc.falta)} para 1 ${rotuloUnidade(1)}.`;
    } else if (calc.sobra > 0 && calc.falta > 0) {
      els.proximo.textContent = `Faltam ${money(calc.falta)} para ${calc.qtd + 1} ${rotuloUnidade(
        calc.qtd + 1
      )}.`;
    } else {
      els.proximo.textContent = "Valor fecha exatamente nesta quantidade.";
    }
  }

  function renderAtalhos() {
    [...els.atalhos.querySelectorAll("button")].forEach((btn) => {
      btn.classList.toggle("active", Number(btn.dataset.valor) === Number(state.valor));
    });
  }

  function renderAll() {
    const visiveis = trechosVisiveis();
    if (!visiveis.some((t) => t.id === state.trechoId)) {
      state.trechoId = visiveis[0] ? visiveis[0].id : null;
    }
    renderPostos();
    renderRotas();
    renderCalc();
    renderAtalhos();
    els.valor.value = formatInput(state.valor);
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
    renderRotas();
  });

  els.valor.addEventListener("input", (e) => {
    state.valor = parseMoney(e.target.value);
    renderCalc();
    renderAtalhos();
    renderRotas();
  });

  els.valor.addEventListener("blur", () => {
    state.valor = roundMoney(Math.max(0, parseMoney(els.valor.value)));
    els.valor.value = formatInput(state.valor);
    renderCalc();
    renderAtalhos();
    renderRotas();
  });

  els.atalhos.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-valor]");
    if (!btn) return;
    state.valor = Number(btn.dataset.valor);
    els.valor.value = formatInput(state.valor);
    renderCalc();
    renderAtalhos();
    renderRotas();
  });

  els.idaVolta.addEventListener("change", (e) => {
    state.idaVolta = e.target.checked;
    renderCalc();
    renderRotas();
  });

  document.getElementById("copiar").addEventListener("click", async () => {
    const trecho = trechoAtual();
    if (!trecho) {
      toast("Selecione uma rota primeiro");
      return;
    }
    const calc = calcularAtual();
    const texto = `${trecho.origem} → ${trecho.destino}: ${money(state.valor)} = ${textoResultado(calc)}`;
    try {
      await navigator.clipboard.writeText(texto);
      toast("Resultado copiado");
    } catch {
      toast(texto);
    }
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
