(function () {
  const { guardAdmin, getClient, showToast } = window.JEAdmin;

  async function init() {
    const profile = await guardAdmin();
    if (!profile) return;
    const toast = document.getElementById('admin-toast');
    const client = await getClient();

    const { data } = await client.from('site_settings').select('value').eq('key', 'donations').maybeSingle();
    const d = data?.value || {};

    document.getElementById('pix-key').value = d.pix_key || '';
    document.getElementById('pix-type').value = d.pix_key_type || 'E-mail';
    document.getElementById('holder').value = d.account_holder || '';
    document.getElementById('bank').value = d.bank || '';
    document.getElementById('qr-url').value = d.qr_image_url || 'img/qrcode.jpg';
    document.getElementById('disclaimer').value = d.disclaimer || '';

    document.getElementById('donations-form').addEventListener('submit', async (e) => {
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

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
