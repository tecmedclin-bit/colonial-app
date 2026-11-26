(async () => {
  const app = window.colonial; const sb = app.client;
  const loginArea = document.getElementById('adminLogin');
  const privateArea = document.getElementById('adminContent');
  if (!app.ready) document.getElementById('setupNotice').hidden = false;
  let currentAdmin = null;
  async function isAdmin() {
    const { data: authData, error } = await sb.auth.getUser();
    if (error || !authData.user) return false;
    const { data: permission } = await sb.from('administradores').select('usuario_id').eq('usuario_id', authData.user.id).maybeSingle();
    currentAdmin = permission ? authData.user : null;
    return Boolean(permission);
  }
  async function openAdmin() {
    const allowed = await isAdmin();
    if (!allowed) { loginArea.hidden = false; privateArea.hidden = true; app.status('adminLoginStatus', 'Acesso exclusivo à equipe autorizada.', 'error'); return; }
    loginArea.hidden = true; privateArea.hidden = false; await refresh();
  }
  document.getElementById('adminLoginForm').addEventListener('submit', async e => {
    e.preventDefault(); if (!app.requireConfig('adminLoginStatus')) return;
    const button = document.getElementById('adminLoginButton'); button.disabled = true;
    app.status('adminLoginStatus', 'Verificando credenciais…');
    const { error } = await sb.auth.signInWithPassword({ email: document.getElementById('adminEmail').value.trim(), password: document.getElementById('adminPassword').value });
    document.getElementById('adminPassword').value = '';
    if (error) app.status('adminLoginStatus', 'E-mail ou senha inválidos.', 'error');
    else await openAdmin();
    button.disabled = false;
  });
  document.getElementById('adminLogout').addEventListener('click', async () => {
    await sb.auth.signOut(); currentAdmin = null; privateArea.hidden = true; loginArea.hidden = false;
  });
  const list = document.getElementById('membersList');
  function el(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }
  function maskCpf(value) { const cpf = String(value || ''); return `***.***.${cpf.slice(6,9)}-**`; }
  async function refresh() {
    list.replaceChildren(); app.status('listStatus', 'Carregando associados…');
    const { data, error } = await sb.from('associados')
      .select('id,nome,cpf,email,telefone,matricula,situacao,caminho_foto,foto_pendente,foto_troca_autorizada,criado_em')
      .order('criado_em', { ascending: false }).limit(200);
    if (error) { app.status('listStatus', 'Falha ao consultar o cadastro.', 'error'); return; }
    document.getElementById('total').textContent = String(data.length);
    document.getElementById('ativos').textContent = String(data.filter(x => x.situacao === 'ativo').length);
    document.getElementById('pendentes').textContent = String(data.filter(x => x.situacao === 'pendente').length);
    app.status('listStatus', `Exibindo ${data.length} registros mais recentes.`);
    if (!data.length) { list.append(el('p','small','Nenhum associado cadastrado ainda.')); return; }
    for (const member of data) {
      const box = el('div','member');
      box.append(el('h3','',member.nome));
      box.append(el('small','',`${member.matricula} • CPF ${maskCpf(member.cpf)}`));
      const state = el('span',`pill ${member.situacao}`,member.situacao.toUpperCase());box.append(state);
      const row = el('div','actions');
      const statusButtons = [['Ativar','ativo'],['Suspender','suspenso'],['Rejeitar','rejeitado']];
      for (const [label, value] of statusButtons) {
        if (member.situacao === value) continue;
        const button = el('button',`btn small ${value === 'ativo' ? '' : 'light'}`,label);button.type='button';
        button.addEventListener('click', async () => {
          if (!window.confirm(`Confirmar situação ${value.toUpperCase()} para ${member.nome}?`)) return;
          button.disabled = true;
          const { error } = await sb.rpc('definir_situacao',{ p_associado_id: member.id, p_situacao: value });
          if (error) { app.status('listStatus', 'Não foi possível alterar a situação.', 'error');button.disabled=false; }
          else await refresh();
        });row.append(button);
      }
      if (member.foto_pendente) {
        const pending=el('div','note warning','Fotografia enviada pelo associado — aguardando aprovação.');
        pending.style.marginTop='12px';box.append(pending);
        const preview=el('img');preview.alt='Fotografia pendente do associado';preview.style.cssText='width:100px;height:125px;object-fit:cover;border-radius:10px;display:block;margin-top:10px';
        box.append(preview);
        sb.storage.from('fotos-associados').createSignedUrl(member.foto_pendente,120).then(({data,error})=>{
          if(!error&&data?.signedUrl)preview.src=data.signedUrl;
          else pending.textContent='Foto pendente — não foi possível abrir a prévia.';
        });
        for(const [label,fn,confirmation] of [
          ['Aprovar foto','aprovar_foto_associado','Aprovar esta fotografia?'],
          ['Rejeitar foto','rejeitar_foto_associado','Rejeitar esta fotografia?']
        ]){
          const button=el('button','btn small '+(fn==='rejeitar_foto_associado'?'light':''),label);button.type='button';
          button.addEventListener('click',async()=>{
            if(!window.confirm(confirmation))return;
            button.disabled=true;
            const {error}=await sb.rpc(fn,{p_associado_id:member.id});
            if(error){app.status('listStatus','Não foi possível processar a fotografia.','error');button.disabled=false;}
            else await refresh();
          });row.append(button);
        }
      }
      if (member.caminho_foto && !member.foto_pendente) {
        if (member.foto_troca_autorizada) {
          const authorized = el('span','pill pendente','NOVA FOTO AUTORIZADA');
          row.append(authorized);
        } else {
          const authorize = el('button','btn small light','Autorizar troca da foto');
          authorize.type = 'button';
          authorize.addEventListener('click', async () => {
            if (!window.confirm(`Autorizar ${member.nome} a enviar uma nova fotografia? A atual permanece ate aprovacao.`)) return;
            authorize.disabled = true;
            const {error} = await sb.rpc('autorizar_troca_foto_associado',{p_associado_id:member.id});
            if (error) { app.status('listStatus','Nao foi possivel autorizar nova fotografia.','error'); authorize.disabled=false; }
            else await refresh();
          });
          row.append(authorize);
        }
      }
      const photoLabel = el('label','btn small light',member.caminho_foto?'Atualizar foto':'Enviar foto');
      const file = el('input');file.type='file';file.accept='image/jpeg,image/png,image/webp';file.hidden=true;
      photoLabel.append(file);
      file.addEventListener('change', async () => {
        const image = file.files?.[0];if (!image) return;
        if (!['image/jpeg','image/png','image/webp'].includes(image.type) || image.size > 5*1024*1024) {
          app.status('listStatus','A foto precisa ser JPEG, PNG ou WebP e ter até 5 MB.','error');return;
        }
        app.status('listStatus', 'Enviando foto para armazenamento protegido…');
        const ext = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[image.type];
        const path = `${member.id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await sb.storage.from('fotos-associados').upload(path,image,{contentType:image.type,upsert:false});
        if (uploadError) { app.status('listStatus','Não foi possível enviar a foto.','error');return; }
        const { error: updateError } = await sb.rpc('definir_foto',{p_associado_id:member.id,p_caminho:path});
        if (updateError) { app.status('listStatus','Foto enviada, mas ainda não vinculada. Avise a administração.','error');return; }
        app.status('listStatus','Fotografia atualizada.'); await refresh();
      });
      row.append(photoLabel);box.append(row);list.append(box);
    }
  }
  document.getElementById('refreshButton').addEventListener('click',refresh);
  document.getElementById('newMemberForm').addEventListener('submit', async e => {
    e.preventDefault(); if (!app.requireConfig('createStatus') || !currentAdmin) return;
    const btn=document.getElementById('createButton');btn.disabled=true;
    app.status('createStatus','Enviando cadastro protegido…');
    try {
      const body={ nome:document.getElementById('nome').value.trim(), cpf:app.formatCpf(document.getElementById('cpf').value), email:document.getElementById('email').value.trim(), telefone:document.getElementById('telefone').value.trim() };
      const { data, error } = await sb.functions.invoke('criar-associado',{body});
      if (error) throw new Error(await app.functionError(error));
      app.status('createStatus',`Cadastro criado: ${data.associado.matricula}. Convite enviado ao e-mail informado.`, 'note ok');
      e.target.reset(); await refresh();
    } catch (error) { app.status('createStatus',app.errMessage(error),'error'); }
    finally {btn.disabled=false;}
  });
  if(sb){const { data:{session} }=await sb.auth.getSession(); if(session) await openAdmin();}
})();
