(function () {
  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Rodapé padrão: Anterior · Remover · Próxima/Próximo
   * @param {object} opts
   * @param {boolean} opts.prevDisabled
   * @param {boolean} opts.nextDisabled
   * @param {string} [opts.removeAttrs] - ex: data-remove-entry="id"
   * @param {string} [opts.nextLabel='Próxima']
   * @param {string} [opts.removeAria='Remover esta entrada']
   * @param {string} [opts.wrapperClass='je-doc-footer qa-doc-footer']
   */
  function renderDocEntryFooter(opts) {
    const {
      prevDisabled,
      nextDisabled,
      removeAttrs = '',
      nextLabel = 'Próxima',
      removeAria = 'Remover esta entrada',
      wrapperClass = 'je-doc-footer qa-doc-footer'
    } = opts;

    return `
      <div class="${escapeHtml(wrapperClass)}">
        <button type="button" data-prev-entry ${prevDisabled ? 'disabled' : ''} class="je-doc-nav-btn qa-doc-nav-btn je-doc-nav-prev qa-doc-nav-prev" aria-label="Entrada anterior">
          <span class="material-symbols-outlined" aria-hidden="true">chevron_left</span>
          <span class="je-doc-nav-label qa-doc-nav-label">Anterior</span>
        </button>
        <button type="button" ${removeAttrs} class="je-doc-nav-btn qa-doc-nav-btn je-doc-nav-remove qa-doc-nav-remove" aria-label="${escapeHtml(removeAria)}">
          <span class="material-symbols-outlined" aria-hidden="true">delete</span>
          <span class="je-doc-nav-remove-label qa-doc-nav-remove-label">Remover</span>
        </button>
        <button type="button" data-next-entry ${nextDisabled ? 'disabled' : ''} class="je-doc-nav-btn qa-doc-nav-btn je-doc-nav-next qa-doc-nav-next" aria-label="Próxima entrada">
          <span class="je-doc-nav-label qa-doc-nav-label">${escapeHtml(nextLabel)}</span>
          <span class="material-symbols-outlined" aria-hidden="true">chevron_right</span>
        </button>
      </div>`;
  }

  window.JEHubDocFooter = { renderDocEntryFooter };
})();
