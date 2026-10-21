/**
 * PORTAL DE DEFESAS DE TCC 2026 - UEPG DELEM
 * Application Logic & Interactivity
 */

(function () {
  'use strict';

  // --- Estado da Aplicação ---
  let bancasData = [];
  const state = {
    view: 'cards', // 'cards' | 'professor' | 'salas'
    search: '',
    dia: 'all',
    turno: 'all',
    area: 'all',
    selectedProf: '',
    salasDay: 'Segunda',
    theme: localStorage.getItem('uepg_tcc_theme') || 'light'
  };

  // Mapeamento de datas para o Google Agenda / .ics (Semana de Defesas 2026)
  // Altere estas datas caso a coordenação defina uma semana específica no calendário letivo:
  const DEFENSE_DATES = {
    'Segunda': '2026-11-23',
    'Terça': '2026-11-24',
    'Sexta': '2026-11-27'
  };

  // --- Elementos do DOM ---
  const bancasContainer = document.getElementById('bancasContainer');
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearch');
  const resultsCount = document.getElementById('resultsCount');
  const resetFiltersBtn = document.getElementById('resetFilters');
  const themeToggleBtn = document.getElementById('themeToggle');
  const printBtn = document.getElementById('printBtn');
  const toast = document.getElementById('toast');

  // Métricas
  const statTotalBancas = document.getElementById('statTotalBancas');
  const statVespBancas = document.getElementById('statVespBancas');
  const statNotBancas = document.getElementById('statNotBancas');
  const statProfs = document.getElementById('statProfs');

  // Visões
  const viewCards = document.getElementById('viewCards');
  const viewProfessor = document.getElementById('viewProfessor');
  const viewSalas = document.getElementById('viewSalas');
  const tabBtns = document.querySelectorAll('.tab-btn');

  // Professor View
  const profSelect = document.getElementById('profSelect');
  const profSummary = document.getElementById('profSummary');
  const profBancasContainer = document.getElementById('profBancasContainer');

  // Salas View
  const salasDayBtns = document.querySelectorAll('.day-tab-btn');
  const salasGridTable = document.getElementById('salasGridTable');

  // --- Inicialização ---
  function init() {
    initTheme();
    loadData();
    bindEvents();
  }

  // --- Gerenciamento de Tema ---
  function initTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
  }

  function toggleTheme() {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('uepg_tcc_theme', state.theme);
    initTheme();
  }

  // --- Carregamento de Dados ---
  function loadData() {
    if (window.BANCAS_DATA && Array.isArray(window.BANCAS_DATA)) {
      bancasData = window.BANCAS_DATA;
      onDataLoaded();
    } else {
      fetch('bancas.json')
        .then(res => res.json())
        .then(data => {
          bancasData = data;
          onDataLoaded();
        })
        .catch(err => {
          console.error('Erro ao carregar bancas.json:', err);
          resultsCount.textContent = 'Erro ao carregar dados do cronograma.';
        });
    }
  }

  function onDataLoaded() {
    updateMetrics();
    populateProfessorSelect();
    render();
  }

  // --- Métricas Gerais ---
  function updateMetrics() {
    statTotalBancas.textContent = bancasData.length;
    statVespBancas.textContent = bancasData.filter(b => b.turno === 'VESPERTINO').length;
    statNotBancas.textContent = bancasData.filter(b => b.turno === 'NOTURNO').length;

    // Contagem de professores únicos
    const profs = new Set();
    bancasData.forEach(b => {
      if (b.orientador) profs.add(b.orientador);
      if (b.membros) b.membros.forEach(m => profs.add(m));
    });
    statProfs.textContent = profs.size;
  }

  // --- Normalizador de Texto para Busca com Acentos ---
  function normalizeText(str) {
    if (!str) return '';
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  // --- Filtragem ---
  function getFilteredBancas() {
    const q = normalizeText(state.search);

    return bancasData.filter(b => {
      // Filtro de Dia
      if (state.dia !== 'all' && b.dia !== state.dia) return false;

      // Filtro de Turno
      if (state.turno !== 'all' && b.turno !== state.turno) return false;

      // Filtro de Área
      if (state.area !== 'all' && b.area !== state.area) return false;

      // Busca por texto
      if (q) {
        const matchAluno = normalizeText(b.aluno).includes(q);
        const matchOri = normalizeText(b.orientador).includes(q);
        const matchTitulo = normalizeText(b.titulo).includes(q);
        const matchSala = normalizeText(b.sala).includes(q);
        const matchMembros = b.membros && b.membros.some(m => normalizeText(m).includes(q));
        if (!matchAluno && !matchOri && !matchTitulo && !matchSala && !matchMembros) {
          return false;
        }
      }

      return true;
    });
  }

  // --- Renderização Principal ---
  function render() {
    if (state.view === 'cards') {
      renderCards();
    } else if (state.view === 'professor') {
      renderProfessorView();
    } else if (state.view === 'salas') {
      renderSalasGrid();
    }
  }

  // --- VIEW 1: Cards Grid ---
  function renderCards() {
    const filtered = getFilteredBancas();
    resultsCount.textContent = `${filtered.length} de ${bancasData.length} bancas encontradas`;

    const hasFilters = state.search || state.dia !== 'all' || state.turno !== 'all' || state.area !== 'all';
    resetFiltersBtn.style.display = hasFilters ? 'inline-block' : 'none';

    if (filtered.length === 0) {
      bancasContainer.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <h3>Nenhuma banca encontrada</h3>
          <p>Tente ajustar os filtros ou os termos da busca.</p>
        </div>
      `;
      return;
    }

    bancasContainer.innerHTML = filtered.map(b => createBancaCardHTML(b)).join('');
  }

  function createBancaCardHTML(b, highlightRole = null) {
    const areaClass = `tag-area-${normalizeText(b.area)}`;
    const turnoClass = `tag-${normalizeText(b.turno)}`;

    const membrosHTML = b.membros && b.membros.length > 0
      ? b.membros.map(m => `
          <div class="person-row">
            <span class="person-label">Avaliador:</span>
            <span class="person-name">${escapeHTML(m)}</span>
          </div>
        `).join('')
      : '';

    let roleTag = '';
    if (highlightRole) {
      roleTag = `<span class="role-badge ${highlightRole === 'Orientador' ? 'role-orientador' : 'role-membro'}">${highlightRole}</span>`;
    }

    return `
      <article class="banca-card" data-banca-id="${b.id}">
        <div>
          <div class="card-header">
            <div class="time-slot">
              <span class="day-badge">${b.dia}</span>
              <span>${b.horario}</span>
              ${roleTag}
            </div>
            <div class="room-badge">${b.sala}</div>
          </div>

          <div class="card-tags">
            <span class="tag ${turnoClass}">${b.turno}</span>
            <span class="tag ${areaClass}">${b.area}</span>
            ${b.hibrida ? '<span class="tag tag-hibrida">Híbrida 💻</span>' : ''}
          </div>

          <h3 class="tcc-title" title="${escapeHTML(b.titulo)}">${escapeHTML(b.titulo)}</h3>

          <div class="people-block">
            <div class="person-row">
              <span class="person-label">Aluno:</span>
              <span class="person-name student">${escapeHTML(b.aluno)}</span>
            </div>
            <div class="person-row">
              <span class="person-label">Orientador:</span>
              <span class="person-name">${escapeHTML(b.orientador)}</span>
            </div>
            ${membrosHTML}
          </div>
        </div>

        <div class="card-actions">
          <button class="btn-action btn-copy" onclick="window.copyBancaInfo(${b.id})" title="Copiar informações para WhatsApp">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            <span>Copiar</span>
          </button>
          <a class="btn-action" href="${createGoogleCalendarUrl(b)}" target="_blank" rel="noopener noreferrer" title="Adicionar no Google Agenda">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span>Agenda</span>
          </a>
          <button class="btn-action" onclick="window.downloadIcs(${b.id})" title="Baixar arquivo .ics para celular">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span>.ICS</span>
          </button>
        </div>
      </article>
    `;
  }

  // --- VIEW 2: Por Professor ---
  function populateProfessorSelect() {
    const profs = new Set();
    bancasData.forEach(b => {
      if (b.orientador) profs.add(b.orientador);
      if (b.membros) b.membros.forEach(m => profs.add(m));
    });

    const sortedProfs = Array.from(profs).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    profSelect.innerHTML = '<option value="">-- Escolha um Professor --</option>' +
      sortedProfs.map(p => `<option value="${escapeHTML(p)}">${escapeHTML(p)}</option>`).join('');
  }

  function renderProfessorView() {
    const selected = state.selectedProf;
    if (!selected) {
      profSummary.style.display = 'none';
      profBancasContainer.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <h3>Selecione um professor acima</h3>
          <p>Você verá a linha do tempo com todas as bancas em que ele atua como orientador ou membro.</p>
        </div>
      `;
      return;
    }

    const dayOrder = { 'Segunda': 1, 'Terça': 2, 'Sexta': 3 };
    const profBancas = bancasData
      .filter(b => b.orientador === selected || (b.membros && b.membros.includes(selected)))
      .sort((a, b) => {
        const dayA = dayOrder[a.dia] || 99;
        const dayB = dayOrder[b.dia] || 99;
        if (dayA !== dayB) return dayA - dayB;
        return a.horario.localeCompare(b.horario);
      });

    const asAdvisor = profBancas.filter(b => b.orientador === selected).length;
    const asMember = profBancas.length - asAdvisor;

    profSummary.style.display = 'flex';
    profSummary.innerHTML = `
      <div class="prof-metric">
        <span class="prof-metric-val">${profBancas.length}</span>
        <span class="prof-metric-label">Bancas Totais</span>
      </div>
      <div class="prof-metric">
        <span class="prof-metric-val">${asAdvisor}</span>
        <span class="prof-metric-label">Como Orientador(a)</span>
      </div>
      <div class="prof-metric">
        <span class="prof-metric-val">${asMember}</span>
        <span class="prof-metric-label">Como Membro Avaliador</span>
      </div>
    `;

    profBancasContainer.innerHTML = profBancas.map(b => {
      const role = b.orientador === selected ? 'Orientador' : 'Membro Avaliador';
      return createBancaCardHTML(b, role);
    }).join('');
  }

  // --- VIEW 3: Grade de Salas ---
  function renderSalasGrid() {
    const day = state.salasDay;
    const dayBancas = bancasData.filter(b => b.dia === day);

    // Identificar salas e horários únicos presentes no dia
    const rooms = Array.from(new Set(dayBancas.map(b => b.sala))).sort();
    const times = Array.from(new Set(dayBancas.map(b => b.horario))).sort();

    if (rooms.length === 0 || times.length === 0) {
      salasGridTable.innerHTML = `<tr><td style="padding: 2rem; text-align: center; color: var(--text-muted);">Nenhuma banca agendada para ${day}.</td></tr>`;
      return;
    }

    let headerHTML = `<thead><tr><th>Horário</th>${rooms.map(r => `<th>Sala ${r}</th>`).join('')}</tr></thead>`;
    let bodyHTML = '<tbody>';

    times.forEach(t => {
      bodyHTML += `<tr><td class="time-col">${t}</td>`;
      rooms.forEach(r => {
        const matches = dayBancas.filter(b => b.horario === t && b.sala === r);
        if (matches.length > 0) {
          bodyHTML += '<td>';
          matches.forEach(m => {
            bodyHTML += `
              <div class="room-cell-entry">
                <div class="student">${escapeHTML(m.aluno)}</div>
                <div class="advisor">Ori: ${escapeHTML(m.orientador)}</div>
              </div>
            `;
          });
          bodyHTML += '</td>';
        } else {
          bodyHTML += '<td style="color: var(--text-light); font-size: 0.8rem;">—</td>';
        }
      });
      bodyHTML += '</tr>';
    });
    bodyHTML += '</tbody>';

    salasGridTable.innerHTML = headerHTML + bodyHTML;
  }

  // --- Utilitários de Calendário e Compartilhamento ---
  function getStartEndISO(banca) {
    const dateStr = DEFENSE_DATES[banca.dia] || '2026-11-23';
    const [h, m] = banca.horario.split(':').map(Number);
    const start = new Date(`${dateStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
    const end = new Date(start.getTime() + 60 * 60 * 1000); // 1 hora de duração
    return { start, end };
  }

  function formatGoogleDate(dt) {
    return dt.toISOString().replace(/-|:|\.\d\d\d/g, '');
  }

  function createGoogleCalendarUrl(b) {
    const { start, end } = getStartEndISO(b);
    const title = encodeURIComponent(`Defesa TCC: ${b.aluno} (${b.sala})`);
    const details = encodeURIComponent(
      `Defesa de TCC - UEPG DELEM\n` +
      `Aluno: ${b.aluno}\n` +
      `Título: ${b.titulo}\n` +
      `Orientador: ${b.orientador}\n` +
      `Banca: ${b.membros.join(', ')}\n` +
      `Turno: ${b.turno} | Área: ${b.area}`
    );
    const location = encodeURIComponent(`Sala ${b.sala}, Bloco B, Campus Central UEPG`);
    const dates = `${formatGoogleDate(start)}/${formatGoogleDate(end)}`;
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}&dates=${dates}`;
  }

  window.downloadIcs = function (bancaId) {
    const b = bancasData.find(x => x.id === bancaId);
    if (!b) return;

    const { start, end } = getStartEndISO(b);
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//UEPG DELEM//TCC 2026//PT',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:tcc-${b.id}-2026@uepg.br`,
      `DTSTAMP:${formatGoogleDate(new Date())}`,
      `DTSTART:${formatGoogleDate(start)}`,
      `DTEND:${formatGoogleDate(end)}`,
      `SUMMARY:Defesa TCC: ${b.aluno} (Sala ${b.sala})`,
      `LOCATION:Sala ${b.sala}\\, Bloco B\\, UEPG`,
      `DESCRIPTION:Defesa de TCC - UEPG DELEM\\nAluno: ${b.aluno}\\nTítulo: ${b.titulo}\\nOrientador: ${b.orientador}\\nBanca: ${b.membros.join(', ')}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Banca_TCC_${b.aluno.replace(/\s+/g, '_')}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Arquivo .ICS baixado!');
  };

  window.copyBancaInfo = function (bancaId) {
    const b = bancasData.find(x => x.id === bancaId);
    if (!b) return;

    const text =
      `🎓 *Defesa de TCC - UEPG DELEM 2026*\n` +
      `📅 *Dia:* ${b.dia} às ${b.horario}\n` +
      `🏢 *Sala:* ${b.sala} (${b.turno})\n` +
      `👤 *Aluno:* ${b.aluno}\n` +
      `📖 *Título:* ${b.titulo}\n` +
      `👨‍🏫 *Orientador:* ${b.orientador}\n` +
      `👥 *Banca:* ${b.membros.join(', ')}\n` +
      `🏷️ *Área:* ${b.area}`;

    navigator.clipboard.writeText(text).then(() => {
      showToast('Informações copiadas para o WhatsApp!');
    }).catch(() => {
      showToast('Erro ao copiar informações.');
    });
  };

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- Event Listeners ---
  function bindEvents() {
    // Busca
    searchInput.addEventListener('input', (e) => {
      state.search = e.target.value.trim();
      clearSearchBtn.style.display = state.search ? 'block' : 'none';
      render();
    });

    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      state.search = '';
      clearSearchBtn.style.display = 'none';
      render();
    });

    // Filtros em Chip
    document.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        const filterType = e.target.getAttribute('data-filter');
        const filterVal = e.target.getAttribute('data-value');

        // Atualizar visual do container do chip
        e.target.parentElement.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');

        state[filterType] = filterVal;
        render();
      });
    });

    resetFiltersBtn.addEventListener('click', () => {
      searchInput.value = '';
      state.search = '';
      clearSearchBtn.style.display = 'none';
      state.dia = 'all';
      state.turno = 'all';
      state.area = 'all';

      document.querySelectorAll('.chip').forEach(c => {
        if (c.getAttribute('data-value') === 'all') c.classList.add('active');
        else c.classList.remove('active');
      });

      render();
    });

    // Abas de Visualização
    tabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const view = e.currentTarget.getAttribute('data-view');
        tabBtns.forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        e.currentTarget.classList.add('active');
        e.currentTarget.setAttribute('aria-selected', 'true');

        state.view = view;
        document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));

        if (view === 'cards') viewCards.classList.add('active');
        else if (view === 'professor') viewProfessor.classList.add('active');
        else if (view === 'salas') viewSalas.classList.add('active');

        render();
      });
    });

    // Seletor de Professor
    profSelect.addEventListener('change', (e) => {
      state.selectedProf = e.target.value;
      renderProfessorView();
    });

    // Seletor de Dia na Grade de Salas
    salasDayBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        salasDayBtns.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        state.salasDay = e.target.getAttribute('data-salas-day');
        renderSalasGrid();
      });
    });

    // Tema
    themeToggleBtn.addEventListener('click', toggleTheme);

    // Impressão
    printBtn.addEventListener('click', () => {
      window.print();
    });
  }

  // Iniciar aplicação
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
