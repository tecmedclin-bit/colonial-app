(async () => {
  const app = window.colonial; const sb = app.client;
  if (!sb) document.getElementById('setupNotice').hidden = false;
  document.querySelectorAll('.pwd-eye').forEach(button => {
    button.addEventListener('click', () => {
      const field = document.getElementById(button.dataset.passwordTarget);
      if (!field) return;
      const show = field.type === 'password';
      field.type = show ? 'text' : 'password';
      button.setAttribute('aria-pressed', String(show));
      button.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
      button.title = show ? 'Ocultar senha' : 'Mostrar senha';
    });
  });
  // Exibe em verde cada requisito cumprido enquanto a pessoa digita.
  const passwordInput = document.getElementById('password');
  const confirmInput = document.getElementById('confirm');
  const specialCharacter = /[^\p{L}\p{N}\s]/u;
  function updatePasswordChecks() {
    const pwd = passwordInput.value;
    const confirmation = confirmInput.value;
    const requirements = [
      ['pwd-min-length', pwd.length >= 8],
      ['pwd-special-char', specialCharacter.test(pwd)],
      ['pwd-match', confirmation.length > 0 && pwd === confirmation]
    ];
    for (const [id, valid] of requirements) {
      const item = document.getElementById(id);
      item.classList.toggle('valid', valid);
      item.querySelector('.pwd-check').textContent = valid ? '✓' : '○';
    }
    document.getElementById('pwd-ready').hidden = !requirements.every(([, valid]) => valid);
  }
  passwordInput.addEventListener('input', updatePasswordChecks);
  confirmInput.addEventListener('input', updatePasswordChecks);
  updatePasswordChecks();
  document.getElementById('passwordForm').addEventListener('submit', async (e) => {
    e.preventDefault(); if (!app.requireConfig('passwordStatus')) return;
    const password = document.getElementById('password').value;
    const confirm = document.getElementById('confirm').value;
    if (password.length < 8) { app.status('passwordStatus','A senha precisa ter pelo menos 8 caracteres.','error');return; }
    if (!/[^\p{L}\p{N}\s]/u.test(password)) { app.status('passwordStatus','Inclua pelo menos um caractere especial, como @, # ou !.','error');return; }
    if (password !== confirm) { app.status('passwordStatus','As duas senhas devem ser iguais.','error');return; }
    const { data:{session} } = await sb.auth.getSession();
    if (!session) { app.status('passwordStatus','Abra o link de ativação ou recuperação enviado ao seu e-mail antes de definir a senha.','error');return; }
    const { error } = await sb.auth.updateUser({password});
    if (error) app.status('passwordStatus','Não foi possível alterar a senha. Solicite um novo link.','error');
    else { e.target.reset(); updatePasswordChecks(); app.status('passwordStatus','Senha definida com sucesso. Faça login para continuar.','note ok'); }
  });
  document.getElementById('resetForm').addEventListener('submit', async (e) => {
    e.preventDefault();if(!app.requireConfig('resetStatus'))return;
    const email=document.getElementById('resetEmail').value.trim();
    const redirectTo=app.config.appBaseUrl.replace(/\/$/,'')+'/ativar-conta.html';
    await sb.auth.resetPasswordForEmail(email,{redirectTo});
    app.status('resetStatus','Se o e-mail estiver cadastrado, você receberá instruções de recuperação.','note ok');
  });
})();
