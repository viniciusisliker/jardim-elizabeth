(function () {
  const { guardPermission, getClient, showToast, escapeHtml } = window.JEAdmin;

  const BUCKET = 'superintendent-visits';
  const MAX_BYTES = 10 * 1024 * 1024;

  let visits = [];
  let currentVisitId = null;
  let documents = [];

  function toastEl() {
    return document.getElementById('hub-admin-toast') || document.getElementById('admin-toast');
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(`${iso}T12:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('pt-BR');
  }

  function fmtSize(bytes) {
    const n = Number(bytes) || 0;
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  function visitLabel(v) {
    const date = v.visit_date ? fmtDate(v.visit_date) : 'Sem data';
    return `${v.title || 'Visita'} · ${date}`;
  }

  async function loadVisits(client) {
    const { data, error } = await client
      .from('superintendent_visits')
      .select('id, title, visit_date, notes, is_visible, updated_at')
      .order('visit_date', { ascending: false, nullsFirst: false })
      .order('updated_at', { ascending: false });
    if (error) throw error;
    visits = data || [];
  }

  async function loadDocuments(client, visitId) {
    if (!visitId) {
      documents = [];
      return;
    }
    const { data, error } = await client
      .from('superintendent_visit_documents')
      .select('id, label, file_name, storage_path, mime_type, size_bytes, sort_order, created_at')
      .eq('visit_id', visitId)
      .order('sort_order')
      .order('created_at');
    if (error) throw error;
    documents = data || [];
  }

  function renderVisitSelect() {
    const select = document.getElementById('sec-visit-select');
    if (!select) return;
    if (!visits.length) {
      select.innerHTML = '<option value="">Nenhuma visita — crie uma nova</option>';
      return;
    }
    select.innerHTML = visits.map((v) =>
      `<option value="${v.id}" ${v.id === currentVisitId ? 'selected' : ''}>${escapeHtml(visitLabel(v))}</option>`
    ).join('');
  }

  function fillForm(visit) {
    document.getElementById('sec-visit-title').value = visit?.title || '';
    document.getElementById('sec-visit-date').value = visit?.visit_date || '';
    document.getElementById('sec-visit-notes').value = visit?.notes || '';
    document.getElementById('sec-visit-visible').checked = visit?.is_visible !== false;
    document.getElementById('sec-visit-delete')?.classList.toggle('hidden', !visit?.id);
  }

  function renderDocuments() {
    const root = document.getElementById('sec-visit-docs');
    if (!root) return;
    if (!currentVisitId) {
      root.innerHTML = '<p class="sec-empty">Salve a visita antes de enviar documentos.</p>';
      return;
    }
    if (!documents.length) {
      root.innerHTML = '<p class="sec-empty">Nenhum documento enviado.</p>';
      return;
    }
    root.innerHTML = documents.map((doc) => `
      <article class="sec-doc-row" data-doc-id="${doc.id}">
        <span class="material-symbols-outlined sec-doc-icon" aria-hidden="true">description</span>
        <div class="sec-doc-body">
          <p class="sec-doc-name">${escapeHtml(doc.label || doc.file_name)}</p>
          <p class="sec-doc-meta">${escapeHtml(doc.file_name)} · ${fmtSize(doc.size_bytes)}</p>
        </div>
        <div class="sec-doc-actions">
          <button type="button" class="sec-btn sec-btn--ghost" data-sec-doc-download="${doc.id}">Baixar</button>
          <button type="button" class="sec-btn sec-btn--danger" data-sec-doc-delete="${doc.id}">Excluir</button>
        </div>
      </article>`).join('');
  }

  async function selectVisit(client, visitId) {
    currentVisitId = visitId || null;
    const visit = visits.find((v) => v.id === currentVisitId) || null;
    fillForm(visit);
    renderVisitSelect();
    await loadDocuments(client, currentVisitId);
    renderDocuments();
  }

  async function saveVisit(client, toast) {
    const title = document.getElementById('sec-visit-title')?.value?.trim();
    const visitDate = document.getElementById('sec-visit-date')?.value || null;
    const notes = document.getElementById('sec-visit-notes')?.value?.trim() || '';
    const isVisible = document.getElementById('sec-visit-visible')?.checked !== false;

    if (!title) {
      showToast(toast, 'Informe um título para a visita.', true);
      return;
    }

    const payload = {
      title,
      visit_date: visitDate || null,
      notes,
      is_visible: isVisible,
      updated_at: new Date().toISOString()
    };

    if (currentVisitId) {
      const { error } = await client.from('superintendent_visits').update(payload).eq('id', currentVisitId);
      if (error) {
        showToast(toast, error.message, true);
        return;
      }
      showToast(toast, 'Visita atualizada.');
    } else {
      const { data, error } = await client.from('superintendent_visits').insert(payload).select('id').single();
      if (error) {
        showToast(toast, error.message, true);
        return;
      }
      currentVisitId = data?.id || null;
      showToast(toast, 'Visita criada.');
    }

    await loadVisits(client);
    await selectVisit(client, currentVisitId);
  }

  async function deleteVisit(client, toast) {
    if (!currentVisitId) return;
    if (!window.JEDialog?.confirm) {
      if (!window.confirm('Excluir esta visita e todos os documentos?')) return;
    } else if (!await window.JEDialog.confirm({
      title: 'Excluir visita',
      message: 'Excluir esta visita e todos os documentos anexados?',
      confirmLabel: 'Excluir',
      danger: true
    })) {
      return;
    }

    const paths = documents.map((d) => d.storage_path).filter(Boolean);
    if (paths.length) {
      await client.storage.from(BUCKET).remove(paths);
    }

    const { error } = await client.from('superintendent_visits').delete().eq('id', currentVisitId);
    if (error) {
      showToast(toast, error.message, true);
      return;
    }

    showToast(toast, 'Visita excluída.');
    currentVisitId = null;
    await loadVisits(client);
    if (visits.length) await selectVisit(client, visits[0].id);
    else {
      fillForm(null);
      documents = [];
      renderVisitSelect();
      renderDocuments();
    }
  }

  async function uploadDocument(client, toast, file) {
    if (!currentVisitId) {
      showToast(toast, 'Salve a visita antes de enviar documentos.', true);
      return;
    }
    if (!file) return;
    if (file.size > MAX_BYTES) {
      showToast(toast, 'Arquivo muito grande (máx. 10 MB).', true);
      return;
    }

    const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
    const path = `${currentVisitId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error: upErr } = await client.storage.from(BUCKET).upload(path, file, {
      upsert: false,
      contentType: file.type || undefined
    });
    if (upErr) {
      showToast(toast, upErr.message, true);
      return;
    }

    const { error: insErr } = await client.from('superintendent_visit_documents').insert({
      visit_id: currentVisitId,
      label: file.name,
      file_name: file.name,
      storage_path: path,
      mime_type: file.type || null,
      size_bytes: file.size,
      sort_order: (documents.length + 1) * 10
    });
    if (insErr) {
      await client.storage.from(BUCKET).remove([path]);
      showToast(toast, insErr.message, true);
      return;
    }

    showToast(toast, 'Documento enviado.');
    await loadDocuments(client, currentVisitId);
    renderDocuments();
  }

  async function downloadDocument(client, toast, docId) {
    const doc = documents.find((d) => d.id === docId);
    if (!doc?.storage_path) return;
    const { data, error } = await client.storage.from(BUCKET).createSignedUrl(doc.storage_path, 3600);
    if (error || !data?.signedUrl) {
      showToast(toast, error?.message || 'Não foi possível abrir o arquivo.', true);
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener');
  }

  async function deleteDocument(client, toast, docId) {
    const doc = documents.find((d) => d.id === docId);
    if (!doc) return;
    if (window.JEDialog?.confirm) {
      const ok = await window.JEDialog.confirm({
        title: 'Excluir documento',
        message: `Excluir "${doc.file_name}"?`,
        confirmLabel: 'Excluir',
        danger: true
      });
      if (!ok) return;
    } else if (!window.confirm(`Excluir "${doc.file_name}"?`)) {
      return;
    }

    if (doc.storage_path) {
      await client.storage.from(BUCKET).remove([doc.storage_path]);
    }
    const { error } = await client.from('superintendent_visit_documents').delete().eq('id', docId);
    if (error) {
      showToast(toast, error.message, true);
      return;
    }
    showToast(toast, 'Documento excluído.');
    await loadDocuments(client, currentVisitId);
    renderDocuments();
  }

  async function init() {
    const profile = await guardPermission('secretario');
    if (!profile) return false;

    const toast = toastEl();
    const client = await getClient();

    if (!window.__JEAdminSecretarioInit) {
      window.__JEAdminSecretarioInit = true;

      document.getElementById('sec-visit-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveVisit(client, toast);
      });

      document.getElementById('sec-visit-new')?.addEventListener('click', () => {
        currentVisitId = null;
        fillForm({ title: 'Visita do Superintendente', notes: '', is_visible: true });
        renderVisitSelect();
        renderDocuments();
      });

      document.getElementById('sec-visit-select')?.addEventListener('change', async (e) => {
        await selectVisit(client, e.target.value || null);
      });

      document.getElementById('sec-visit-delete')?.addEventListener('click', () => deleteVisit(client, toast));

      document.getElementById('sec-visit-upload')?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        await uploadDocument(client, toast, file);
      });

      document.getElementById('sec-visit-docs')?.addEventListener('click', async (e) => {
        const downloadId = e.target.closest('[data-sec-doc-download]')?.dataset.secDocDownload;
        const deleteId = e.target.closest('[data-sec-doc-delete]')?.dataset.secDocDelete;
        if (downloadId) await downloadDocument(client, toast, downloadId);
        if (deleteId) await deleteDocument(client, toast, deleteId);
      });
    }

    try {
      await loadVisits(client);
      if (visits.length) await selectVisit(client, visits[0].id);
      else {
        fillForm({ title: 'Visita do Superintendente', notes: '', is_visible: true });
        renderVisitSelect();
        renderDocuments();
      }
    } catch (err) {
      showToast(toast, err?.message || 'Erro ao carregar visitas.', true);
    }

    return true;
  }

  window.JEAdminSecretario = { init };
})();
