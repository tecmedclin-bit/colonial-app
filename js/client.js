/* Supabase JS carregado no HTML; esta configuração nunca contém segredos de servidor. */
window.colonial = (() => {
  const config = window.COLONIAL_CONFIG || {};
  const ready = Boolean(config.supabaseUrl && config.supabasePublishableKey);
  let client = null;
  if (ready && window.supabase) {
    client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
      auth: {
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: true,
  experimental: { passkey: true }
}
    });
  }
  function status(id, message, type = '') {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = message;
    el.className = `status ${type}`;
  }
  function requireConfig(id = 'status') {
    if (!client) {
      status(id, 'Ainda falta conectar o Supabase. Não digite dados reais neste teste.', 'error');
      return false;
    }
    return true;
  }
  function formatCpf(value) {
    return String(value || '').replace(/\D/g, '').slice(0, 11);
  }
  function errMessage(error) {
    if (!error) return 'Não foi possível concluir a operação.';
    // As funções retornam mensagens próprias, sem divulgar credenciais.
    return error.message || 'Ocorreu um erro de conexão.';
  }
  async function functionError(error) {
    if (error && error.context && typeof error.context.json === 'function') {
      try {
        const json = await error.context.json();
        if (json && json.erro) return json.erro;
      } catch (_) {}
    }
    return errMessage(error);
  }
  return { config, ready: Boolean(client), client, status, requireConfig, formatCpf, errMessage, functionError };
})();
