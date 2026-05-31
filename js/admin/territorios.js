(function () {
  const { guardAdmin, getClient, showToast, escapeHtml, STATUS_LABELS } = window.JEAdmin;

  async function init() {
    const profile = await guardAdmin();
    if (!profile) return;
    const toast = document.getElementById('admin-toast');
    const client = await getClient();
    let territories = [];

    async function reload() {
      const { data } = await client.from('territories').select('*').order('sort_order');
      territories = data || [];
      renderGrid();
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
        btn.addEventListener('click', () => openForm(territories.find((t) => t.id === btn.dataset.edit)))
      );
      grid.querySelectorAll('[data-status]').forEach((sel) =>
        sel.addEventListener('change', async () => {
          const { error } = await client.from('territories').update({ status: sel.value }).eq('id', sel.dataset.status);
          if (error) showToast(toast, error.message, true);
          else showToast(toast, 'Status atualizado.');
        })
      );
    }

    function openForm(t) {
      document.getElementById('terr-form').classList.remove('hidden');
      document.getElementById('terr-id').value = t.id;
      document.getElementById('terr-num').value = t.num;
      document.getElementById('terr-name').value = t.display_name;
      document.getElementById('terr-image').value = t.map_image_url || '';
      document.getElementById('terr-status').value = t.status || 'disponivel';
    }

    document.getElementById('terr-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const { error } = await client.from('territories').update({
        display_name: document.getElementById('terr-name').value.trim(),
        map_image_url: document.getElementById('terr-image').value.trim(),
        status: document.getElementById('terr-status').value
      }).eq('id', document.getElementById('terr-id').value);
      if (error) showToast(toast, error.message, true);
      else { showToast(toast, 'Território atualizado.'); document.getElementById('terr-form').classList.add('hidden'); await reload(); }
    });
    document.getElementById('btn-cancel').addEventListener('click', () => document.getElementById('terr-form').classList.add('hidden'));

    await reload();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
