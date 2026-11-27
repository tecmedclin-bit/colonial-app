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
    if (!file ||
        !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
        file.size > 5 * 1024 * 1024) {
        throw new Error('Escolha uma fotografia de até 5 MB.');
    }

    const image = new Image();
    const url = URL.createObjectURL(file);
    let segmenter;

    try {
        await new Promise((resolve, reject) => {
            image.onload = resolve;
            image.onerror = reject;
            image.src = url;
        });

        const { ImageSegmenter, FilesetResolver } = await import(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs'
        );

        const vision = await FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm'
        );

        segmenter = await ImageSegmenter.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite',
                delegate: 'CPU'
            },
            runningMode: 'IMAGE',
            outputConfidenceMasks: true,
            outputCategoryMask: false
        });

        const iw = image.naturalWidth;
        const ih = image.naturalHeight;

        if (iw < 200 || ih < 200) {
            throw new Error('Fotografia com resolução muito baixa.');
        }

        const escala = Math.min(1, 1200 / Math.max(iw, ih));

        const original = document.createElement('canvas');
        original.width = Math.round(iw * escala);
        original.height = Math.round(ih * escala);

        const ctx = original.getContext('2d');
        ctx.drawImage(image, 0, 0, original.width, original.height);

        const mask = document.createElement('canvas');
        let processado = false;

        segmenter.segment(original, result => {
            const fundo = result.confidenceMasks?.[0];

            if (!fundo || result.confidenceMasks.length !== 6) {
                return;
            }

            mask.width = fundo.width;
            mask.height = fundo.height;

            const mctx = mask.getContext('2d');
            const valores = fundo.getAsFloat32Array();
            const pixels = mctx.createImageData(mask.width, mask.height);

            for (let i = 0; i < valores.length; i++) {
                const pessoa = 1 - valores[i];

                let a = Math.max(0, Math.min(1,
                    (pessoa - 0.18) / 0.57));

                a = a * a * (3 - 2 * a);

                pixels.data[i * 4] = 255;
                pixels.data[i * 4 + 1] = 255;
                pixels.data[i * 4 + 2] = 255;
                pixels.data[i * 4 + 3] = Math.round(a * 255);
            }

            mctx.putImageData(pixels, 0, 0);
            processado = true;
        });

        if (!processado) {
            throw new Error('Não foi possível separar o fundo.');
        }

        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(mask, 0, 0, original.width, original.height);

        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, original.width, original.height);
        ctx.globalCompositeOperation = 'source-over';

        const canvas = document.createElement('canvas');
        canvas.width = 600;
        canvas.height = 750;

        const finalCtx = canvas.getContext('2d');
        const zoom = Math.max(
            600 / original.width,
            750 / original.height
        );

        const largura = original.width * zoom;
        const altura = original.height * zoom;

        finalCtx.imageSmoothingEnabled = true;
        finalCtx.imageSmoothingQuality = 'high';
        finalCtx.fillStyle = '#ffffff';
        finalCtx.fillRect(0, 0, 600, 750);

        finalCtx.drawImage(
            original,
            (600 - largura) / 2,
            (750 - altura) / 2,
            largura,
            altura
        );

        const blob = await new Promise(resolve =>
            canvas.toBlob(resolve, 'image/jpeg', 0.96)
        );

        if (!blob) {
            throw new Error('Não foi possível preparar a fotografia.');
        }

        return blob;

    } finally {
        if (segmenter) segmenter.close();
        URL.revokeObjectURL(url);
    }
}

async function prepararFotoAntiga(file) {

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

// Refinamento do contorno da fotografia
const alpha = new Uint8ClampedArray(w * h);

for (let i = 0; i < alpha.length; i++) {
    alpha[i] = d[i * 4 + 3];
}

function refinarMascara(src, raio, expandir) {
    const temp = new Uint8ClampedArray(src.length);
    const out = new Uint8ClampedArray(src.length);

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let v = expandir ? 0 : 255;

            for (let k = -raio; k <= raio; k++) {
                const xx = Math.max(0, Math.min(w - 1, x + k));
                const a = src[y * w + xx];
                v = expandir ? Math.max(v, a) : Math.min(v, a);
            }

            temp[y * w + x] = v;
        }
    }

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let v = expandir ? 0 : 255;

            for (let k = -raio; k <= raio; k++) {
                const yy = Math.max(0, Math.min(h - 1, y + k));
                const a = temp[yy * w + x];
                v = expandir ? Math.max(v, a) : Math.min(v, a);
            }

            out[y * w + x] = v;
        }
    }

    return out;
}

// Corrigir pequenas falhas no contorno
const fechada = refinarMascara(
    refinarMascara(alpha, 5, true), 5, false
);

const refinada = refinarMascara(fechada, 2, true);

for (let i = 0; i < refinada.length; i++) {
    d[i * 4 + 3] = refinada[i];
}

mctx.putImageData(pixels, 0, 0);

// Suavizar as bordas do recorte
ctx.filter = 'blur(1px)';
ctx.drawImage(mask, 0, 0, w, h);
ctx.filter = 'none';


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
    // Preferencia de acesso biometrico neste navegador
  const bioKey = 'colonial-bio-preferencia-v2';
  const btn = document.getElementById('loginBtn');
  const logout = document.getElementById('logoutBtn');
  const bioDisponivel = Boolean(sb && window.isSecureContext &&
    window.PublicKeyCredential &&
    typeof sb.auth.registerPasskey === 'function' &&
    typeof sb.auth.signInWithPasskey === 'function');

  function bioPreferida() {
    try { return localStorage.getItem(bioKey); }
    catch (_) { return null; }
  }

  function bioSalvar(uid) {
    try { localStorage.setItem(bioKey, uid); return true; }
    catch (_) { return false; }
  }

  function oferecerBio(uid) {
    if (!bioDisponivel || !uid || !activeMember ||
        bioPreferida() === uid ||
        !window.HTMLDialogElement ||
        !HTMLDialogElement.prototype.showModal) return;

    const d = document.createElement('dialog');

    d.style.cssText = 'width:calc(100% - 40px);max-width:350px;padding:25px;border:0;border-radius:20px;box-shadow:0 0 0 100vmax #03152baa;text-align:center;color:#10365e;';

    d.setAttribute('aria-labelledby', 'bioTitulo');

    d.innerHTML = `<svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M2 12a10 10 0 0 1 18-6M22 12a10 10 0 0 0-1-4M6 12a6 6 0 0 1 12 0c0 4-1 7-2 9M10 12a2 2 0 0 1 4 0c0 5-1 8-3 10M2 16c0 2-.2 3-1 4M6 16c0 2-.5 4-1.5 6M10 16c-.1 2-.5 4-1.5 6M22 16l-1 4"/></svg>
    <h2 id="bioTitulo">Ativar biometria?</h2>
    <p>Nos próximos acessos, confirme sua identidade pelo celular. Use somente em seu aparelho pessoal.</p>
    <button type="button" class="btn full" id="bioSim">ATIVAR BIOMETRIA</button>
    <button type="button" class="btn full light" id="bioNao" style="margin-top:10px">AGORA NÃO</button>
    <p id="bioMsg" class="status" role="status"></p>`;

    const sim = d.querySelector('#bioSim');
    const nao = d.querySelector('#bioNao');
    const msg = d.querySelector('#bioMsg');

    d.addEventListener('close', () => d.remove());

    d.addEventListener('cancel', e => {
      if (sim.disabled) e.preventDefault();
    });

    nao.onclick = () => d.close();

    sim.onclick = async () => {
      sim.disabled = nao.disabled = logout.disabled = true;
      msg.textContent = 'Confirme no seu aparelho...';

      try {
        const {data:auth,error:authError} =
          await sb.auth.getUser();

        if (authError || auth?.user?.id !== uid)
          throw new Error('Sessão alterada');

        const {error} = await sb.auth.registerPasskey();

        if (error) throw error;

        if (bioSalvar(uid)) {
          d.close();
          app.status('cardStatusMessage',
            'Acesso biométrico ativado neste navegador.');
        } else {
          msg.textContent =
            'Chave cadastrada, mas o navegador não permitiu salvar a preferência.';
        }

      } catch (_) {
        msg.textContent =
          'Não foi possível ativar. Tente novamente ou escolha Agora não.';
      } finally {
        sim.disabled = nao.disabled = logout.disabled = false;
      }
    };

    document.body.append(d);

    try { d.showModal(); }
    catch (_) { d.remove(); }
  }

  async function entrarBio() {
    btn.disabled = true;
    form.hidden = true;

    app.status('loginStatus',
      'Confirme sua identidade no aparelho...');

    const controle = new AbortController();
    const limite = setTimeout(() => controle.abort(), 45000);

    try {
      const {data,error} = await sb.auth.signInWithPasskey({
        options: {signal: controle.signal}
      });

      if (error || !data?.session)
        throw error || new Error('Sessão inválida');

      await showMember();

      if (!activeMember)
        throw new Error('Cadastro não localizado');

      bioSalvar(data.session.user.id);
      app.status('loginStatus','');

    } catch (_) {
      activeMember = null;
      memberPanel.hidden = true;
      card.hidden = true;
      loginPanel.hidden = false;

      app.status('loginStatus',
        'Utilize seu CPF e senha para continuar.');

    } finally {
      clearTimeout(limite);
      form.hidden = false;
      btn.disabled = false;
    }
  }

  form.addEventListener('submit',async(event)=>{
    event.preventDefault();

    if(btn.disabled || !app.requireConfig('loginStatus'))return;

    const cpf=app.formatCpf(document.getElementById('cpf').value);
    const senha=document.getElementById('senha').value;

    if(cpf.length!==11){
      app.status('loginStatus','Informe um CPF válido.','error');
      return;
    }

    btn.disabled=true;
    app.status('loginStatus','Verificando seu acesso…');

    try {
      const {data,error}=await sb.functions.invoke(
        'login-cpf',{body:{cpf,senha}}
      );

      if(error)throw new Error(await app.functionError(error));

      if(!data?.access_token||!data?.refresh_token)
        throw new Error('Resposta de login inválida.');

      const {data:auth,error:sessionError}=
        await sb.auth.setSession({
          access_token:data.access_token,
          refresh_token:data.refresh_token
        });

      if(sessionError)throw sessionError;

      document.getElementById('senha').value='';
      activeMember=null;

      await showMember();

      if(activeMember) {
        app.status('loginStatus','');
        oferecerBio(auth?.session?.user?.id);
      }

    }catch(error){
      app.status('loginStatus',app.errMessage(error),'error');
    }
    finally{btn.disabled=false;}
  });

  logout.addEventListener('click',async()=>{
    if(sb){
      const {error}=await sb.auth.signOut();

      if(error){
        app.status('cardStatusMessage',
          'Não foi possível sair. Tente novamente.','error');
        return;
      }
    }

    memberPanel.hidden=true;
    loginPanel.hidden=false;
    card.hidden=true;
    activeMember=null;

    if(localPhotoPreview){
      URL.revokeObjectURL(localPhotoPreview);
      localPhotoPreview=null;
    }
  });

  if(sb){
    btn.disabled=true;

    try {
      const {data:{session}}=await sb.auth.getSession();

      if(bioDisponivel && bioPreferida() &&
        (!session || session.user.id===bioPreferida())) {
        await entrarBio();
      } else if(session) {
        await showMember();
      }
    } finally {
      btn.disabled=false;
    }
  }
})();
    
