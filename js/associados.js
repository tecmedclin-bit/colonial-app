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
  let localPhotoPreview = null;
  function mostrarFoto(url) {
    const photo = document.getElementById('memberPhoto');
    const empty = document.getElementById('fallbackPhoto');
    photo.src = url; photo.hidden = false; empty.hidden = true;
  }
  function fotoTravada(member) { return Boolean(member && (member.foto_pendente || (member.caminho_foto && !member.foto_troca_autorizada))); }
  function atualizarEnvioFoto(member) {
    const travada = fotoTravada(member);
    document.getElementById('photoButton').disabled = travada;
    document.querySelector('#photoButton .photo-edit').hidden = travada;
    selfiePanel.hidden = !member || member.situacao !== 'ativo' || travada;
    document.getElementById('pendingPhotoText').hidden = !member?.foto_pendente;
    document.getElementById('photoButton').setAttribute('aria-label',travada?'Fotografia bloqueada. Solicite autorizacao ao clube.':'Enviar ou trocar foto autorizada');
  }
  if (!app.ready) document.getElementById('setupNotice').hidden = false;
  document.getElementById('photoButton').addEventListener('click', () => {if(activeMember?.situacao==='ativo' && !fotoTravada(activeMember)) document.getElementById('choosePhoto').click();});
  document.getElementById('takeSelfie').addEventListener('click', () => {if(activeMember && !fotoTravada(activeMember)) selfieInput.click();});
  document.getElementById('choosePhoto').addEventListener('click', () => {if(activeMember && !fotoTravada(activeMember)) galleryInput.click();});
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
      // Compor retrato em uma tela de 600x750 para padronizar carteirinha.
      const portrait=document.createElement('canvas'); portrait.width=w; portrait.height=h;
      const pctx=portrait.getContext('2d');
      pctx.filter='brightness(1.04) contrast(1.04)';
      pctx.drawImage(image,sx,sy,sw,sh,0,0,w,h);
      pctx.filter='none';
      // O modelo roda no dispositivo; a foto não é enviada ao provedor do modelo.
      if(typeof window.SelfieSegmentation!=='function') throw new Error('A remoção do fundo está indisponível. Verifique a conexão e tente novamente.');
      const segmenter=new window.SelfieSegmentation({locateFile:(file)=>'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1.1675465747/'+file});
      let resultado=false;
      segmenter.setOptions({modelSelection:0});
      segmenter.onResults((r)=>{
        if(!r.segmentationMask) return;
        ctx.save();
        ctx.clearRect(0,0,w,h);
        
const mask = document.createElement('canvas');
mask.width = w;
mask.height = h;

const mctx = mask.getContext('2d');
mctx.drawImage(r.segmentationMask, 0, 0, w, h);

const pixels = mctx.getImageData(0, 0, w, h);
const d = pixels.data;

let minAlpha = 255;
let maxAlpha = 0;

for (let i = 0; i < d.length; i += 4) {
    minAlpha = Math.min(minAlpha, d[i + 3]);
    maxAlpha = Math.max(maxAlpha, d[i + 3]);
}

const useAlpha = maxAlpha - minAlpha > 30;

for (let i = 0; i < d.length; i += 4) {
    const v = useAlpha ? d[i + 3] : d[i];
    d[i] = 255;
    d[i + 1] = 255;
    d[i + 2] = 255;
    d[i + 3] = v;
}

mctx.putImageData(pixels, 0, 0);
ctx.drawImage(mask, 0, 0, w, h);

        ctx.globalCompositeOperation='source-in';
        ctx.drawImage(portrait,0,0,w,h);
        ctx.globalCompositeOperation='destination-over';
        ctx.fillStyle='#ffffff';
        ctx.fillRect(0,0,w,h);
        ctx.restore();
        resultado=true;
      });
      try { await segmenter.send({image:portrait}); }
      finally { if(typeof segmenter.close==='function') segmenter.close(); }
      if(!resultado) throw new Error('Não foi possível separar o fundo desta foto. Tente outra imagem com boa iluminação.');
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.87));
      if(!blob)throw new Error('Não foi possível converter a fotografia.');
      return blob;
    }finally{URL.revokeObjectURL(url);}
  }
  async function enviarFoto(event){
    const file=event.target.files?.[0];if(!file||!activeMember||!sb)return;
    if(fotoTravada(activeMember)) {app.status('photoStatus','Foto já aprovada ou aguardando análise. Para trocar, procure a administração.','error');event.target.value='';return;}
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
      activeMember.foto_pendente=path;
      activeMember.foto_troca_autorizada=false;
      if (localPhotoPreview) URL.revokeObjectURL(localPhotoPreview);
      localPhotoPreview = URL.createObjectURL(blob);
      mostrarFoto(localPhotoPreview);
      atualizarEnvioFoto(activeMember);
      app.status('photoStatus','Fotografia enviada! Aguarde a aprovação da administração.');
    }catch(error){app.status('photoStatus',error.message||'Erro ao enviar fotografia.','error');}
    finally{event.target.value='';selfie.disabled=false;gallery.disabled=false;}
  }
  selfieInput.addEventListener('change',enviarFoto);galleryInput.addEventListener('change',enviarFoto);
  async function showMember(){
    const {data:userData,error:userError}=await sb.auth.getUser();const user=userData?.user;
    if(userError||!user){loginPanel.hidden=false;memberPanel.hidden=true;return;}
    const {data:person,error}=await sb.from('associados')
      .select('nome,matricula,situacao,caminho_foto,foto_pendente,foto_troca_autorizada,token_validacao')
      .eq('usuario_auth_id',user.id).maybeSingle();
    if(error){app.status('loginStatus','Não foi possível carregar seu cadastro.','error');return;}
    activeMember=person;loginPanel.hidden=true;memberPanel.hidden=false;
    atualizarEnvioFoto(person);
    document.getElementById('fallbackPhoto').textContent=person?.foto_pendente?'AGUARDANDO APROVAÇÃO':'TOQUE PARA ENVIAR FOTO';
    if(!person){notice.hidden=false;notice.textContent='Seu usuário ainda não está vinculado a um cadastro no Colonial. Procure a administração.';card.hidden=true;return;}
    if(person.situacao!=='ativo'){notice.hidden=false;notice.textContent=`Sua situação cadastral é: ${person.situacao.toUpperCase()}. A carteirinha não está liberada.`;card.hidden=true;return;}
    notice.hidden=true;card.hidden=false;
    document.getElementById('memberName').textContent=person.nome;
    document.getElementById('memberNumber').textContent=person.matricula;
    document.getElementById('memberStatus').textContent='ATIVO';
    document.getElementById('memberPhoto').hidden=true;
    document.getElementById('fallbackPhoto').hidden=false;
    // Mostra a foto APROVADA ou a FOTO PENDENTE como pre-visualizacao, sem
    // dar ao associado a possibilidade de substituir a foto ja enviada.
    const caminhoExibido = person.foto_pendente || person.caminho_foto;
    if (caminhoExibido) {
      const {data:photo,error:photoError}=await sb.storage.from('fotos-associados').createSignedUrl(caminhoExibido,120);
      
if (!photoError && photo?.signedUrl) {
    mostrarFoto(photo.signedUrl);

    const membroAtual = person;
    const fotoOriginal = photo.signedUrl;

    try {
        const resposta = await fetch(fotoOriginal);
        if (!resposta.ok) {
            throw new Error('Foto indisponível');
        }

        const imagem = await resposta.blob();
        const fotoTratada = await prepararFoto(imagem);

        if (activeMember === membroAtual) {
            if (localPhotoPreview) {
                URL.revokeObjectURL(localPhotoPreview);
            }

            localPhotoPreview = URL.createObjectURL(fotoTratada);
            mostrarFoto(localPhotoPreview);
        }
    } catch (erro) {
        console.warn('Não foi possível remover o fundo:', erro);
    }
}

      else if (localPhotoPreview) mostrarFoto(localPhotoPreview);
      else document.getElementById('fallbackPhoto').textContent='FOTO EM ANALISE';
    }

    const url=new URL(app.config.appBaseUrl.replace(/\/$/,'')+'/validar.html');url.searchParams.set('t',person.token_validacao);
    const qr=document.getElementById('qr');qr.replaceChildren();
    if(window.QRCode)new window.QRCode(qr,{text:url.toString(),width:256,height:256,correctLevel:window.QRCode.CorrectLevel.M});
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
    if(localPhotoPreview){URL.revokeObjectURL(localPhotoPreview);localPhotoPreview=null;}
  });
  if(sb){const {data:{session}}=await sb.auth.getSession();if(session)await showMember();}
})();
