(async () => {
  const app = window.colonial;const sb = app.client;
  if (!sb) document.getElementById('setupNotice').hidden = false;
  document.getElementById('passwordForm').addEventListener('submit', async (e) => {
    e.preventDefault();if(!app.requireConfig('passwordStatus'))return;
    const password=document.getElementById('password').value;
    const confirm=document.getElementById('confirm').value;
    if (password.length < 12 || password !== confirm) { app.status('passwordStatus','As senhas devem coincidir e conter pelo menos 12 caracteres.','error');return; }
    const { data:{session} } = await sb.auth.getSession();
    if (!session) { app.status('passwordStatus','Abra o link de ativação ou recuperação enviado ao seu e-mail antes de definir a senha.','error');return; }
    const { error } = await sb.auth.updateUser({password});
    if (error) app.status('passwordStatus','Não foi possível alterar a senha. Solicite um novo link.','error');
    else { e.target.reset();app.status('passwordStatus','Senha definida com sucesso. Você já pode entrar com CPF e senha!','note ok'); }
  });
  document.getElementById('resetForm').addEventListener('submit', async (e) => {
    e.preventDefault();if(!app.requireConfig('resetStatus'))return;
    const email=document.getElementById('resetEmail').value.trim();
    const redirectTo=app.config.appBaseUrl.replace(/\/$/,'')+'/ativar-conta.html';
    await sb.auth.resetPasswordForEmail(email,{redirectTo});
    // Resposta genérica para não permitir enumeração de contas.
    app.status('resetStatus','Se o e-mail estiver cadastrado, você receberá instruções de recuperação.','note ok');
  });
})();
