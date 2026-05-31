(function () {
  const { guardPermission, getClient } = window.JEAdmin;

  async function init() {
    const profile = await guardPermission('agenda');
    if (!profile) return;

    const client = await getClient();
    await window.JEHubEvents?.initHubEvents(client);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
