(function () {
  const { guardPermission, getClient, showToast } = window.JEAdmin;

  function toastEl() {
    return document.getElementById('hub-admin-toast') || document.getElementById('admin-toast');
  }

  async function init() {
    if (window.__JEAdminDonativosInit) return;
    window.__JEAdminDonativosInit = true;
    const profile = await guardPermission('donativos');
    if (!profile) return;
    const toast = toastEl();
    const client = await getClient();

    const { data } = await client.from('site_settings').select('value').eq('key', 'donations').maybeSingle();
    const d = data?.value || {};

    document.getElementById('pix-key').value = d.pix_key || '';
    document.getElementById('pix-type').value = d.pix_key_type || 'E-mail';
    document.getElementById('holder').value = d.account_holder || '';
    document.getElementById('bank').value = d.bank || '';
    document.getElementById('qr-url').value = d.qr_image_url || 'img/qrcode.jpg';
    document.getElementById('disclaimer').value = d.disclaimer || '';

    const form = document.getElementById('donations-form');
    if (form.dataset.bound === '1') return;
    form.dataset.bound = '1';

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const value = {
        pix_key: document.getElementById('pix-key').value.trim(),
        pix_key_type: document.getElementById('pix-type').value.trim(),
        account_holder: document.getElementById('holder').value.trim(),
        bank: document.getElementById('bank').value.trim(),
        qr_image_url: document.getElementById('qr-url').value.trim(),
        disclaimer: document.getElementById('disclaimer').value.trim()
      };
      const { error } = await client.from('site_settings').upsert({ key: 'donations', value });
      if (error) showToast(toast, error.message, true);
      else showToast(toast, 'Donativos atualizados no site.');
    });
  }

  window.JEAdminDonativos = { init };

  if (!window.JEHubRouter && document.getElementById('donations-form')) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }
})();
