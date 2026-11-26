(async () => {
  const app = window.colonial;
  const sb = app.client;
  const form = document.getElementById('loginForm');
  const loginPanel = document.getElementById('loginPanel');
  const memberPanel = document.getElementById('memberPanel');
  const card = document.getElementById('card');
  const notice = document.getElementById('pendingNotice');
  const selfiePanel = document.getElementById('selfiePanel');
  const selfieInput = document.getElementById('selfieInput');
  const galleryInput = document.getElementById('galleryInput');
  let activeMember = null;
  if (!app.ready) document.getElementById('setupNotice').hidden = false;
  document.getElementById('photoButton').addEventListener('click', () => {if(activeMember)document.getElementById('choosePhoto').click()});
  document.getElementById('takeSelfie').addEventListener('click', () => selfieInput.click());
  document.getElementById('choosePhoto').addEventListener('click', () => galleryInput.click());
  async function prepararFoto(file) {
    if (!file || !['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5*1024*1024) throw new Error('Escolha uma imagem JPEG, PNG ou WebP de até 5 MB.');
    const image = new Image(); const url = URL.createObjectURL(file);
    try {
      await new Promise((resolve,reject)=>{ image.onload=resolve; image.onerror=()=>reject(new Error('Não foi possível abrir a foto.')); image.src=url; });
      const w=600,h=750,ratio=w/h,iw=image.naturalWidth,ih=image.naturalHeight;
      if (iw<200 || ih<200) throw new Error('Imagem com resolução muito baixa.');
      const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
      const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Não foi possível preparar a imagem.');
      let sw=iw,sh=ih,sx=0,sy=0;
      if(iw/ih>ratio){sw=ih*ratio;sx=(iw-sw)/2;}else{sh=iw/ratio;sy=(ih-sh)/2;}
      ctx.filter='brightness(1.04) contrast(1.04)';
      ctx.drawImage(image,sx,sy,sw,sh,0,0,w,h);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.87));
      if(!blob)throw new Error('Não foi possível converter a fotografia.');
      return blob;
    }finally{URL.revokeObjectURL(url);}
  }
  async function enviarFoto(event){
    const file=event.target.files?.[0];if(!file||!activeMember||!sb)return;
    const selfie=document.getElementById('takeSelfie'),gallery=document.getElementById('choosePhoto');
    selfie.disabled=true;gallery.disabled=true;app.status('photoStatus','Preparando e enviando sua fotografia…');
    try{
      const {data,error:authError}=await sb.auth.getUser();
      const uid=data?.user?.id;if(authError||!uid)throw new Error('Entre novamente na sua conta para enviar a foto.');
      const blob=await prepararFoto(file);
      const path=uid+'/pendente/'+crypto.randomUUID()+'.jpg';
      const {error:uploadError}=await sb.storage.from('fotos-associados').upload(path,blob,{contentType:'image/jpeg',upsert:false});
      if(uploadError)throw new Error('Não foi possível armazenar a foto. Verifique a conexão e as permissões.');
      const {error:rpcError}=await sb.rpc('solicitar_foto_associado',{p_caminho:path});
      if(rpcError)throw new Error('Foto enviada, mas não encaminhada à aprovação. Procure a administração.');
      document.getElementById('pendingPhotoText').hidden=false;
      app.status('photoStatus','Fotografia enviada! Aguarde a aprovação da administração.');
    }catch(error){app.status('photoStatus',error.message||'Erro ao enviar fotografia.','error');}
    finally{event.target.value='';selfie.disabled=false;gallery.disabled=false;}
  }
  selfieInput.addEventListener('change',enviarFoto);galleryInput.addEventListener('change',enviarFoto);
  async function showMember(){
    const {data:userData,error:userError}=await sb.auth.getUser();const user=userData?.user;
    if(userError||!user){loginPanel.hidden=false;memberPanel.hidden=true;return;}
    const {data:person,error}=await sb.from('associados')
      .select('nome,matricula,situacao,caminho_foto,foto_pendente,token_validacao')
      .eq('usuario_auth_id',user.id).maybeSingle();
    if(error){app.status('loginStatus','Não foi possível carregar seu cadastro.','error');return;}
    activeMember=person;loginPanel.hidden=true;memberPanel.hidden=false;
    selfiePanel.hidden=!person||person.situacao!=='ativo';
    document.getElementById('pendingPhotoText').hidden=!person?.foto_pendente;
    if(!person){notice.hidden=false;notice.textContent='Seu usuário ainda não está vinculado a um cadastro no Colonial. Procure a administração.';card.hidden=true;return;}
    if(person.situacao!=='ativo'){notice.hidden=false;notice.textContent=`Sua situação cadastral é: ${person.situacao.toUpperCase()}. A carteirinha não está liberada.`;card.hidden=true;return;}
    notice.hidden=true;card.hidden=false;
    document.getElementById('memberName').textContent=person.nome;
    document.getElementById('memberNumber').textContent=person.matricula;
    document.getElementById('memberStatus').textContent='ATIVO';
    document.getElementById('memberPhoto').hidden=true;
    document.getElementById('fallbackPhoto').hidden=false;
    if(person.caminho_foto){
      const {data:photo}=await sb.storage.from('fotos-associados').createSignedUrl(person.caminho_foto,120);
      if(photo?.signedUrl){document.getElementById('memberPhoto').src=photo.signedUrl;document.getElementById('memberPhoto').hidden=false;document.getElementById('fallbackPhoto').hidden=true;}
    }
    const url=new URL(app.config.appBaseUrl.replace(/\/$/,'')+'/validar.html');url.searchParams.set('t',person.token_validacao);
    const qr=document.getElementById('qr');qr.replaceChildren();
    if(window.QRCode)new window.QRCode(qr,{text:url.toString(),width:88,height:88,correctLevel:window.QRCode.CorrectLevel.M});
    else{const a=document.createElement('a');a.href=url.href;a.textContent='Validar carteirinha';qr.append(a);}
    app.status('cardStatusMessage','Sua carteirinha é pessoal. A validação depende de conexão com a internet.');
  }
  form.addEventListener('submit',async(event)=>{
    event.preventDefault();if(!app.requireConfig('loginStatus'))return;
    const btn=document.getElementById('loginBtn');
    const cpf=app.formatCpf(document.getElementById('cpf').value),senha=document.getElementById('senha').value;
    if(cpf.length!==11){app.status('loginStatus','Informe um CPF válido.','error');return;}
    btn.disabled=true;app.status('loginStatus','Verificando seu acesso…');
    try{const {data,error}=await sb.functions.invoke('login-cpf',{body:{cpf,senha}});
      if(error)throw new Error(await app.functionError(error));
      if(!data?.access_token||!data?.refresh_token)throw new Error('Resposta de login inválida.');
      const {error:sessionError}=await sb.auth.setSession({access_token:data.access_token,refresh_token:data.refresh_token});
      if(sessionError)throw sessionError;
      document.getElementById('senha').value='';await showMember();app.status('loginStatus','');
    }catch(error){app.status('loginStatus',app.errMessage(error),'error');}
    finally{btn.disabled=false;}
  });
  document.getElementById('logoutBtn').addEventListener('click',async()=>{
    if(sb)await sb.auth.signOut();memberPanel.hidden=true;loginPanel.hidden=false;card.hidden=true;activeMember=null;
  });
  if(sb){const {data:{session}}=await sb.auth.getSession();if(session)await showMember();}
})();
