(function () {
  const MAX_STACK = 20;
  const stacks = Object.create(null);
  const BTN_IDS = {
    territorios: 'terr-btn-undo',
    'carrinhos-displays': 'eq-btn-undo'
  };

  function getStack(scope) {
    if (!stacks[scope]) stacks[scope] = [];
    return stacks[scope];
  }

  function peek(scope) {
    const stack = getStack(scope);
    return stack.length ? stack[stack.length - 1] : null;
  }

  function canUndo(scope) {
    return getStack(scope).length > 0;
  }

  function push(scope, entry) {
    if (!entry || typeof entry.undo !== 'function') return;
    const stack = getStack(scope);
    stack.push({
      label: entry.label || 'Última ação',
      undo: entry.undo
    });
    if (stack.length > MAX_STACK) stack.shift();
    updateUi(scope);
  }

  async function undo(scope, client) {
    const stack = getStack(scope);
    if (!stack.length) return null;
    const entry = stack[stack.length - 1];
    await entry.undo(client);
    stack.pop();
    updateUi(scope);
    return entry;
  }

  function updateUi(scope) {
    const btn = document.getElementById(BTN_IDS[scope]);
    if (!btn) return;
    const entry = peek(scope);
    const enabled = !!entry;
    btn.disabled = !enabled;
    btn.title = enabled ? `Desfazer: ${entry.label}` : 'Nenhuma ação para desfazer';
    btn.setAttribute('aria-disabled', enabled ? 'false' : 'true');
  }

  function bind(scope, options = {}) {
    const btn = document.getElementById(BTN_IDS[scope]);
    if (!btn || btn.dataset.undoBound === '1') return;
    btn.dataset.undoBound = '1';
    btn.addEventListener('click', async () => {
      if (!canUndo(scope)) return;
      btn.disabled = true;
      try {
        const client = await options.getClient();
        const undone = await undo(scope, client);
        if (undone) {
          if (options.onAfterUndo) await options.onAfterUndo();
          if (options.showToast && options.toastEl) {
            options.showToast(options.toastEl, `Desfeito: ${undone.label}.`);
          }
        }
      } catch (err) {
        updateUi(scope);
        if (options.showToast && options.toastEl) {
          options.showToast(options.toastEl, err?.message || 'Erro ao desfazer.', true);
        }
      }
    });
    updateUi(scope);
  }

  function pickRow(row, fields) {
    const out = {};
    fields.forEach((key) => {
      if (row && Object.prototype.hasOwnProperty.call(row, key)) out[key] = row[key];
    });
    return out;
  }

  function registerUpdate(scope, table, id, beforeRow, label, fields) {
    const restore = fields ? pickRow(beforeRow, fields) : { ...beforeRow };
    delete restore.id;
    push(scope, {
      label,
      undo: async (client) => {
        const { error } = await client.from(table).update(restore).eq('id', id);
        if (error) throw error;
      }
    });
  }

  function registerInsert(scope, table, rowId, label) {
    push(scope, {
      label,
      undo: async (client) => {
        const { error } = await client.from(table).delete().eq('id', rowId);
        if (error) throw error;
      }
    });
  }

  function registerDelete(scope, table, row, label) {
    const snapshot = { ...row };
    push(scope, {
      label,
      undo: async (client) => {
        const { error } = await client.from(table).insert(snapshot);
        if (error) throw error;
      }
    });
  }

  function registerToggle(scope, table, id, field, previousValue, label) {
    push(scope, {
      label,
      undo: async (client) => {
        const { error } = await client
          .from(table)
          .update({ [field]: previousValue, updated_at: new Date().toISOString() })
          .eq('id', id);
        if (error) throw error;
      }
    });
  }

  window.JEHubUndo = {
    push,
    undo,
    bind,
    canUndo,
    peek,
    updateUi,
    registerUpdate,
    registerInsert,
    registerDelete,
    registerToggle
  };
})();
