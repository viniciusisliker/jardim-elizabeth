(function () {
  const { guardPermission, getClient, showToast, escapeHtml, STATUS_LABELS } = window.JEAdmin;
  const H = window.JETerritoryAssignment;

  async function init() {
    const profile = await guardPermission('territorios');
    if (!profile) return;
    const toast = document.getElementById('admin-toast');
    const client = await getClient();
    let territories = [];
    let members = [];
    let assignments = [];

    async function reloadTerritories() {
      const { data } = await client.from('territories').select('*').order('sort_order');
      territories = data || [];
      renderGrid();
      fillTerritorySelect();
    }

    async function reloadMembers() {
      const { data } = await client
        .from('profiles')
        .select('id, full_name, username, role')
        .order('full_name');
      members = data || [];
      fillProfileSelect();
    }

    async function reloadAssignments() {
      const today = H.toISODate(new Date());
      const { data, error } = await client
        .from('territory_assignments')
        .select(`
          id, week_start, work_date, work_time, meeting_point, notes,
          profile_id, territory_id,
          profiles ( full_name, username ),
          territories ( num, display_name )
        `)
        .gte('work_date', today)
        .order('work_date', { ascending: true })
        .limit(50);
      if (error) {
        document.getElementById('assignments-list').innerHTML =
          `<p class="text-sm text-error">${escapeHtml(error.message)}</p>`;
        return;
      }
      assignments = data || [];
      renderAssignments();
    }

    function memberLabel(m) {
      const handle = m.username ? ` (@${m.username})` : '';
      return `${m.full_name || 'Sem nome'}${handle}`;
    }

    function fillProfileSelect(selectedId) {
      const sel = document.getElementById('assign-profile');
      sel.innerHTML = `<option value="">Selecione o irmão</option>${members.map((m) =>
        `<option value="${m.id}" ${m.id === selectedId ? 'selected' : ''}>${escapeHtml(memberLabel(m))}</option>`
      ).join('')}`;
    }

    function fillTerritorySelect(selectedId) {
      const sel = document.getElementById('assign-territory');
      sel.innerHTML = `<option value="">Selecione o território</option>${territories.map((t) =>
        `<option value="${t.id}" ${t.id === selectedId ? 'selected' : ''}>T${escapeHtml(t.num)} — ${escapeHtml(t.display_name)}</option>`
      ).join('')}`;
    }

    function renderAssignments() {
      const list = document.getElementById('assignments-list');
      if (!assignments.length) {
        list.innerHTML = '<p class="text-sm text-on-surface-variant">Nenhuma designação futura cadastrada.</p>';
        return;
      }
      list.innerHTML = assignments.map((a) => {
        const name = a.profiles?.full_name || '—';
        const terr = a.territories ? `T${a.territories.num} · ${a.territories.display_name}` : '—';
        const time = a.work_time ? ` · ${H.formatTime(a.work_time)}` : '';
        return `
          <div class="terr-assign-row">
            <div>
              <p class="font-semibold text-primary text-sm">${escapeHtml(name)}</p>
              <p class="text-xs text-on-surface-variant">${escapeHtml(terr)}</p>
            </div>
            <p class="text-xs text-on-surface-variant">Semana ${escapeHtml(H.formatWeekRange(a.week_start))}</p>
            <p class="text-xs text-on-surface-variant">${escapeHtml(H.formatWeekday(a.work_date))}, ${escapeHtml(H.formatDisplayDate(a.work_date))}${escapeHtml(time)}</p>
            <div class="flex gap-2">
              <button type="button" data-edit-assign="${a.id}" class="text-xs font-semibold text-secondary">Editar</button>
              <button type="button" data-del-assign="${a.id}" class="text-xs font-semibold text-error">Excluir</button>
            </div>
          </div>`;
      }).join('');

      list.querySelectorAll('[data-edit-assign]').forEach((btn) =>
        btn.addEventListener('click', () => openAssignForm(assignments.find((a) => a.id === btn.dataset.editAssign)))
      );
      list.querySelectorAll('[data-del-assign]').forEach((btn) =>
        btn.addEventListener('click', () => deleteAssignment(btn.dataset.delAssign))
      );
    }

    function renderGrid() {
      const grid = document.getElementById('territory-grid');
      grid.innerHTML = territories.map((t) => `
        <div class="bg-white border border-outline-variant rounded-xl p-4">
          <div class="flex items-start justify-between gap-2 mb-3">
            <div>
              <p class="text-[10px] font-bold text-secondary uppercase">T${escapeHtml(t.num)}</p>
              <p class="font-bold text-primary text-sm">${escapeHtml(t.display_name)}</p>
            </div>
            <button type="button" data-edit="${t.id}" class="text-xs font-semibold text-secondary shrink-0">Editar</button>
          </div>
          <select data-status="${t.id}" class="w-full text-xs rounded-lg border-outline-variant">
            ${Object.entries(STATUS_LABELS).map(([k, v]) =>
              `<option value="${k}" ${t.status === k ? 'selected' : ''}>${v}</option>`
            ).join('')}
          </select>
        </div>`).join('');

      grid.querySelectorAll('[data-edit]').forEach((btn) =>
        btn.addEventListener('click', () => openTerrForm(territories.find((t) => t.id === btn.dataset.edit)))
      );
      grid.querySelectorAll('[data-status]').forEach((sel) =>
        sel.addEventListener('change', async () => {
          const { error } = await client.from('territories').update({ status: sel.value }).eq('id', sel.dataset.status);
          if (error) showToast(toast, error.message, true);
          else showToast(toast, 'Status atualizado.');
        })
      );
    }

    function openTerrForm(t) {
      document.getElementById('terr-form').classList.remove('hidden');
      document.getElementById('terr-id').value = t.id;
      document.getElementById('terr-num').value = t.num;
      document.getElementById('terr-name').value = t.display_name;
      document.getElementById('terr-image').value = t.map_image_url || '';
      document.getElementById('terr-status').value = t.status || 'disponivel';
    }

    function openAssignForm(a) {
      document.getElementById('assign-form').classList.remove('hidden');
      document.getElementById('assign-form-title').textContent = a ? 'Editar designação' : 'Nova designação';
      document.getElementById('assign-id').value = a?.id || '';
      fillProfileSelect(a?.profile_id);
      fillTerritorySelect(a?.territory_id);
      const monday = H.toISODate(H.getMonday(new Date()));
      document.getElementById('assign-week').value = a?.week_start || monday;
      document.getElementById('assign-day').value = a?.work_date || monday;
      document.getElementById('assign-time').value = a?.work_time ? String(a.work_time).slice(0, 5) : '';
      document.getElementById('assign-meeting').value = a?.meeting_point || '';
      document.getElementById('assign-notes').value = a?.notes || '';
      document.getElementById('assign-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function closeAssignForm() {
      document.getElementById('assign-form').classList.add('hidden');
      document.getElementById('assign-id').value = '';
    }

    async function deleteAssignment(id) {
      if (!window.confirm('Excluir esta designação?')) return;
      const { error } = await client.from('territory_assignments').delete().eq('id', id);
      if (error) showToast(toast, error.message, true);
      else {
        showToast(toast, 'Designação excluída.');
        await reloadAssignments();
      }
    }

    document.getElementById('assign-week').addEventListener('change', (e) => {
      e.target.value = H.snapToMonday(e.target.value);
    });

    document.getElementById('assign-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const weekStart = H.snapToMonday(document.getElementById('assign-week').value);
      const workDate = document.getElementById('assign-day').value;
      const weekEnd = H.parseISODate(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const work = H.parseISODate(workDate);
      if (work < H.parseISODate(weekStart) || work > weekEnd) {
        showToast(toast, 'O dia de trabalho deve estar dentro da semana selecionada.', true);
        return;
      }

      const payload = {
        profile_id: document.getElementById('assign-profile').value,
        territory_id: document.getElementById('assign-territory').value,
        week_start: weekStart,
        work_date: workDate,
        work_time: document.getElementById('assign-time').value || null,
        meeting_point: document.getElementById('assign-meeting').value.trim() || null,
        notes: document.getElementById('assign-notes').value.trim() || null
      };

      const id = document.getElementById('assign-id').value;
      const query = id
        ? client.from('territory_assignments').update(payload).eq('id', id)
        : client.from('territory_assignments').insert(payload);
      const { error } = await query;
      if (error) {
        showToast(toast, error.message, true);
        return;
      }

      await client.from('territories').update({ status: 'designado' }).eq('id', payload.territory_id);
      showToast(toast, id ? 'Designação atualizada.' : 'Designação criada.');
      closeAssignForm();
      await reloadAssignments();
      await reloadTerritories();
    });

    document.getElementById('btn-new-assignment').addEventListener('click', () => openAssignForm(null));
    document.getElementById('assign-cancel').addEventListener('click', closeAssignForm);

    document.getElementById('terr-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const { error } = await client.from('territories').update({
        display_name: document.getElementById('terr-name').value.trim(),
        map_image_url: document.getElementById('terr-image').value.trim(),
        status: document.getElementById('terr-status').value
      }).eq('id', document.getElementById('terr-id').value);
      if (error) showToast(toast, error.message, true);
      else {
        showToast(toast, 'Território atualizado.');
        document.getElementById('terr-form').classList.add('hidden');
        await reloadTerritories();
      }
    });
    document.getElementById('btn-cancel').addEventListener('click', () => document.getElementById('terr-form').classList.add('hidden'));

    await Promise.all([reloadTerritories(), reloadMembers(), reloadAssignments()]);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
