(function () {
  const { guardPermission, getClient } = window.JEAdmin;

  async function init() {
    const profile = await guardPermission('secretario');
    if (!profile) return false;

    const client = await getClient();
    await window.JEAdminSecretarioService?.initService?.(client);
    return true;
  }

  window.JEAdminSecretario = { init };
})();
