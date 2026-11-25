(async () => {
  const app = window.colonial;
  const sb = app.client;
  const form = document.getElementById('loginForm');
  const loginPanel = document.getElementById('loginPanel');
  const memberPanel = document.getElementById('memberPanel');
  const card = document.getElementById('card');
  const notice = document.getElementById('pendingNotice');
  if (!app.ready) document.getElementById('setupNotice').hidden = false;
  async function showMember() {
    const { data: userData, error: userError } = await sb.auth.getUser();
    const user = userData?.user;
    if (userError || !user) { loginPanel.hidden = false; memberPanel.hidden = true; return; }
    const { data: person, error } = await sb.from('associados')
      .select('nome,matricula,situacao,caminho_foto,token_validacao')
      .eq('usuario_auth_id', user.id).maybeSingle();
    if (error) { app.status('loginStatus', 'Não foi possível carregar seu cadastro.', 'error'); return; }
    loginPanel.hidden = true;
    memberPanel.hidden = false;
    if (!person) { notice.hidden = false; notice.textContent = 'Seu usuário ainda não está vinculado a um cadastro no Colonial. Procure a administração.'; return; }
    if (person.situacao !== 'ativo') {
      notice.hidden = false;
      notice.textContent = `Sua situação cadastral é: ${person.situacao.toUpperCase()}. A carteirinha não está liberada.`;
      card.hidden = true;
      return;
    }
    notice.hidden = true; card.hidden = false;
    document.getElementById('memberName').textContent = person.nome;
    document.getElementById('memberNumber').textContent = person.matricula;
    document.getElementById('memberStatus').textContent = 'ATIVO';
    if (person.caminho_foto) {
      const { data: photo } = await sb.storage.from('fotos-associados').createSignedUrl(person.caminho_foto, 120);
      if (photo?.signedUrl) {
        document.getElementById('memberPhoto').src = photo.signedUrl;
        document.getElementById('memberPhoto').hidden = false;
        document.getElementById('fallbackPhoto').hidden = true;
      }
    }
    const url = new URL(app.config.appBaseUrl.replace(/\/$/, '') + '/validar.html');
    url.searchParams.set('t', person.token_validacao);
    const qr = document.getElementById('qr'); qr.replaceChildren();
    if (window.QRCode) new window.QRCode(qr, { text: url.toString(), width: 88, height: 88, correctLevel: window.QRCode.CorrectLevel.M });
    else { const a = document.createElement('a'); a.href = url.href; a.textContent = 'Validar carteirinha'; qr.append(a); }
    app.status('cardStatusMessage', 'Sua carteirinha é pessoal. A validação depende de conexão com a internet.');
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!app.requireConfig('loginStatus')) return;
    const btn = document.getElementById('loginBtn');
    const cpf = app.formatCpf(document.getElementById('cpf').value);
    const senha = document.getElementById('senha').value;
    if (cpf.length !== 11) { app.status('loginStatus', 'Informe um CPF válido.', 'error'); return; }
    btn.disabled = true;
    app.status('loginStatus', 'Verificando seu acesso…');
    try {
      const { data, error } = await sb.functions.invoke('login-cpf', { body: { cpf, senha } });
      if (error) throw new Error(await app.functionError(error));
      if (!data?.access_token || !data?.refresh_token) throw new Error('Resposta de login inválida.');
      const { error: sessionError } = await sb.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
      if (sessionError) throw sessionError;
      document.getElementById('senha').value = '';
      await showMember();
      app.status('loginStatus', '');
    } catch (error) { app.status('loginStatus', app.errMessage(error), 'error'); }
    finally { btn.disabled = false; }
  });
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    if (sb) await sb.auth.signOut();
    memberPanel.hidden = true; loginPanel.hidden = false; card.hidden = true;
  });
  if (sb) {
    const { data: { session } } = await sb.auth.getSession();
    if (session) await showMember();
  }
})();
