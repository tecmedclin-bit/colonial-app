(async () => {
  const app=window.colonial, sb=app.client, $=id=>document.getElementById(id);
  const loginArea=$('adminLogin'), privateArea=$('adminContent'), list=$('membersList'), requests=$('requestsList');
  if(!app.ready) $('setupNotice').hidden=false;
  let currentAdmin=null, members=[], generation=0;
  function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
  function button(text,fn,cls='btn small light'){const b=el('button',cls,text);b.type='button';b.addEventListener('click',fn);return b;}
  const normalize=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const digits=v=>String(v??'').replace(/\D/g,'');
  const formatCpf=v=>digits(v).replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/,'$1.$2.$3-$4');
  const date=v=>v?String(v).slice(0,10).split('-').reverse().join('/'):'Não informado';
  function clear(){generation++;members=[];list.replaceChildren();requests.replaceChildren();$('memberSearch').value='';for(const id of ['total','ativos','pendentes'])$(id).textContent='0';app.status('listStatus','');app.status('requestsStatus','');$('newMemberForm').reset();app.status('createStatus','');}
  async function isAdmin(){const {data,error}=await sb.auth.getUser();if(error||!data?.user)return false;const {data:permission,error:pError}=await sb.from('administradores').select('usuario_id').eq('usuario_id',data.user.id).maybeSingle();currentAdmin=!pError&&permission?data.user:null;return Boolean(currentAdmin);}
  async function openAdmin(){if(!await isAdmin()){clear();loginArea.hidden=false;privateArea.hidden=true;app.status('adminLoginStatus','Acesso exclusivo à equipe autorizada.','error');return;}loginArea.hidden=true;privateArea.hidden=false;await refresh();}
  $('adminLoginForm').addEventListener('submit',async e=>{e.preventDefault();if(!app.requireConfig('adminLoginStatus'))return;const b=$('adminLoginButton');b.disabled=true;app.status('adminLoginStatus','Verificando credenciais…');try{const {error}=await sb.auth.signInWithPassword({email:$('adminEmail').value.trim(),password:$('adminPassword').value});if(error)app.status('adminLoginStatus','E-mail ou senha inválidos.','error');else await openAdmin();}catch{app.status('adminLoginStatus','Não foi possível entrar.','error');}finally{$('adminPassword').value='';b.disabled=false;}});
  $('adminLogout').addEventListener('click',async()=>{currentAdmin=null;clear();privateArea.hidden=true;loginArea.hidden=false;const {error}=await sb.auth.signOut();if(error)app.status('adminLoginStatus','Não foi possível encerrar a sessão no servidor. Tente novamente.','error');});
  const fields='nome,cpf,rg,data_nascimento,estado_civil,profissao,email,telefone,cep,endereco,numero,complemento,bairro,cidade,estado';
  async function allRows(table,columns){const out=[];const step=200;for(let start=0;;start+=step){const {data,error}=await sb.from(table).select(columns).order('id',{ascending:true}).range(start,start+step-1);if(error)throw error;out.push(...data);if(data.length<step)break;}return out.sort((a,b)=>String(a.nome).localeCompare(String(b.nome),'pt-BR',{sensitivity:'base'})||String(a.id).localeCompare(String(b.id)));}
  function fieldGrid(m,request=false){const grid=el('div','details-grid');const fields=[['Nome completo',m.nome],['CPF',formatCpf(m.cpf)],['RG',m.rg],['Nascimento',date(m.data_nascimento)],['Estado civil',m.estado_civil],['Profissão',m.profissao],['Telefone / WhatsApp',m.telefone],['E-mail',m.email],['CEP',m.cep],['Rua / Avenida',m.endereco],['Número',m.numero],['Complemento',m.complemento],['Bairro',m.bairro],['Cidade',m.cidade],['Estado',m.estado]];if(!request)fields.push(['Matrícula',m.matricula],['Data de admissão',date(m.data_admissao)]);fields.push(['Situação',String(m.situacao||'').toUpperCase()],['Cadastro recebido em',date(m.criado_em)]);for(const [k,v] of fields){const f=el('div','field');f.append(el('small','',k),el('strong','',v||'Não informado'));grid.append(f);}return grid;}
  function makeDetails(m,request=false){const box=el('details','member');if(!request)box.dataset.memberId=String(m.id);const summary=el('summary');const title=el('div');title.append(el('h3','',m.nome),el('small','',request?'Solicitação de associação':`${m.matricula} • CPF ***.***.${digits(m.cpf).slice(6,9)}-**`));summary.append(title,el('span',`pill ${m.situacao}`,String(m.situacao).toUpperCase()));box.append(summary);const body=el('div','member-body');box.append(body);let initialized=false;box.addEventListener('toggle',()=>{if(!box.open||initialized||!currentAdmin)return;initialized=true;const printHead=el('div','print-head');printHead.append(el('h2','','COLONIAL ESPORTE CLUBE'),el('p','',request?'SOLICITAÇÃO DE ASSOCIAÇÃO':'FICHA CADASTRAL DO ASSOCIADO'));body.append(printHead);if(!request){const photos=el('div','photo-row');body.append(photos);for(const [path,label] of [[m.caminho_foto,'Fotografia aprovada'],[m.foto_pendente,'Fotografia pendente']]){if(!path)continue;const fig=el('figure'),img=el('img','photo-preview');img.alt=label;const cap=el('figcaption','',label);fig.append(img,cap);photos.append(fig);sb.storage.from('fotos-associados').createSignedUrl(path,120).then(({data,error})=>{if(!currentAdmin||!box.isConnected)return;if(!error&&data?.signedUrl)img.src=data.signedUrl;else cap.textContent=label+' — indisponível';});}if(!m.caminho_foto&&!m.foto_pendente)photos.append(el('small','','Nenhuma fotografia cadastrada.'));}body.append(fieldGrid(m,request));if(!request)body.append(makeActions(m,box));});return box;}
  function openCadastroEditor(m,box){
    if(!currentAdmin||!box.isConnected)return;
    const existing=box.querySelector('.cadastro-editor');
    if(existing){existing.querySelector('input')?.focus();return;}
    const form=el('form','actions cadastro-editor');
    form.style.cssText='display:block;margin-top:16px;padding:14px;border:1px solid #d8e3ee;border-radius:12px;background:#f5f8fc';
    form.append(el('h3','','Editar cadastro'),el('p','small','Atualize os dados necessários. CPF, e-mail, matrícula, senha e situação não serão alterados.'));
    const grid=el('div','details-grid');form.append(grid);
    const schema=[['nome','Nome completo',140],['rg','RG',30],['data_nascimento','Data de nascimento',0,'date'],['estado_civil','Estado civil',40],['profissao','Profissão',100],['telefone','Telefone / WhatsApp',30,'tel'],['cep','CEP',9],['endereco','Rua / Avenida',180],['numero','Número',20],['complemento','Complemento',100],['bairro','Bairro',100],['cidade','Cidade',100],['estado','Estado (UF)',2]];
    const inputs={};
    for(const [key,label,max,type] of schema){
      const group=el('div'), lab=el('label','label',label), input=el('input');
      input.id=`edit-${m.id}-${key}`;lab.htmlFor=input.id;input.name=key;input.type=type||'text';input.autocomplete='off';
      input.value=key==='data_nascimento'?String(m[key]||'').slice(0,10):String(m[key]??'');
      if(max)input.maxLength=max;if(key==='nome')input.required=true;
      if(key==='data_nascimento'){const now=new Date();input.max=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');}
      if(key==='cep'){input.inputMode='numeric';input.pattern='[0-9]{5}-?[0-9]{3}';input.title='Informe um CEP com oito números';input.addEventListener('input',()=>{input.value=digits(input.value).slice(0,8).replace(/^(\d{5})(\d)/,'$1-$2');});}
      if(key==='estado'){input.pattern='AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO';input.title='Informe uma UF válida, como RJ';input.addEventListener('input',()=>{input.value=input.value.toUpperCase();});}
      inputs[key]=input;group.append(lab,input);grid.append(group);
    }
    const msg=el('p','status');msg.setAttribute('role','status');
    const actions=el('div','actions');const save=el('button','btn small','SALVAR ALTERAÇÕES');save.type='submit';
    const cancel=button('Cancelar',()=>form.remove());actions.append(save,cancel);form.append(actions,msg);
    form.addEventListener('submit',async e=>{
      e.preventDefault();if(!currentAdmin||!form.isConnected)return;
      const payload=Object.fromEntries(Object.entries(inputs).map(([k,v])=>[k,v.value.trim()]));
      if(!payload.nome){msg.textContent='Informe o nome completo.';return;}
      save.disabled=true;cancel.disabled=true;for(const input of Object.values(inputs))input.disabled=true;
      msg.className='status';msg.textContent='Salvando alterações…';const adminId=currentAdmin.id;
      try{
        const {error}=await sb.rpc('editar_cadastro_associado',{p_associado_id:String(m.id),p_dados:payload});
        if(error)throw error;
        if(currentAdmin?.id!==adminId)return;
        form.remove();await refresh();
        if(currentAdmin?.id!==adminId)return;
        const updated=members.find(x=>x.id===m.id);
        if(updated){app.status('listStatus','Cadastro atualizado com sucesso.');const card=Array.from(list.querySelectorAll('.member')).find(x=>x.dataset.memberId===String(m.id));if(card)card.open=true;}
        else app.status('listStatus','Alterações salvas. Atualize a lista para conferir os dados.');
      }catch(error){if(currentAdmin?.id!==adminId||!form.isConnected)return;msg.className='status error';msg.textContent='Não foi possível salvar. Confira os dados e a função de edição no Supabase.';}
      finally{save.disabled=false;cancel.disabled=false;for(const input of Object.values(inputs))input.disabled=false;}
    });
    box.querySelector('.member-body').append(form);inputs.nome.focus();
  }
  function makeActions(m,box){const row=el('div','actions');function rpcBtn(label,fn,args,message,cls){const b=button(label,async()=>{if(!currentAdmin||!window.confirm(message))return;b.disabled=true;try{const {error}=await sb.rpc(fn,args);if(error){app.status('listStatus','Não foi possível concluir a operação.','error');b.disabled=false;}else await refresh();}catch{app.status('listStatus','Falha de conexão.','error');b.disabled=false;}},cls);row.append(b);}
    for(const [label,value] of [['Ativar','ativo'],['Colocar pendente','pendente'],['Suspender','suspenso'],['Rejeitar','rejeitado']]){if(m.situacao!==value)rpcBtn(label,'definir_situacao',{p_associado_id:m.id,p_situacao:value},`Confirmar situação ${value.toUpperCase()} para ${m.nome}?`,value==='ativo'?'btn small':'btn small light');}
    if(m.foto_pendente){rpcBtn('Aprovar foto','aprovar_foto_associado',{p_associado_id:m.id},'Aprovar esta fotografia?','btn small');rpcBtn('Rejeitar foto','rejeitar_foto_associado',{p_associado_id:m.id},'Rejeitar esta fotografia?');}
    if(m.caminho_foto&&!m.foto_pendente){if(m.foto_troca_autorizada)row.append(el('span','pill pendente','NOVA FOTO AUTORIZADA'));else rpcBtn('Autorizar troca da foto','autorizar_troca_foto_associado',{p_associado_id:m.id},`Autorizar ${m.nome} a enviar uma nova fotografia? A atual permanece até aprovação.`);}
    const photoLabel=el('label','btn small light',m.caminho_foto?'Atualizar foto':'Enviar foto');const file=el('input');file.type='file';file.accept='image/jpeg,image/png,image/webp';file.hidden=true;photoLabel.append(file);file.addEventListener('change',async()=>{const image=file.files?.[0];if(!image||!currentAdmin)return;if(!['image/jpeg','image/png','image/webp'].includes(image.type)||image.size>5*1024*1024){app.status('listStatus','A foto precisa ser JPEG, PNG ou WebP e ter até 5 MB.','error');file.value='';return;}file.disabled=true;app.status('listStatus','Enviando fotografia…');try{const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[image.type];const path=`${m.id}/${crypto.randomUUID()}.${ext}`;const {error:up}=await sb.storage.from('fotos-associados').upload(path,image,{contentType:image.type,upsert:false});if(up)throw Error('Não foi possível armazenar a fotografia.');const {error}=await sb.rpc('definir_foto',{p_associado_id:m.id,p_caminho:path});if(error)throw Error('Foto enviada, mas não vinculada.');await refresh();}catch(e){app.status('listStatus',e.message||'Erro ao enviar a foto.','error');}finally{file.disabled=false;file.value='';}});row.append(photoLabel);
    row.append(button('Editar cadastro',()=>openCadastroEditor(m,box),'btn small'));
    row.append(button('Imprimir / salvar PDF',()=>{if(!currentAdmin)return;list.querySelectorAll('.printing').forEach(n=>n.classList.remove('printing'));box.classList.add('printing');try{window.print();}finally{box.classList.remove('printing');}}));return row;
  }
  function renderMembers(){list.replaceChildren();const q=normalize($('memberSearch').value),d=digits(q),cpfSearch=/^[\d.\-\s]+$/.test(q)&&d;const shown=members.filter(m=>!q||normalize(m.nome).includes(q)||normalize(m.matricula).includes(q)||(cpfSearch&&digits(m.cpf).includes(d)));app.status('listStatus',`Exibindo ${shown.length} de ${members.length} associados.`);if(!shown.length){list.append(el('p','small','Nenhum associado encontrado.'));return;}const fragment=document.createDocumentFragment();for(const m of shown)fragment.append(makeDetails(m));list.append(fragment);}
  async function refresh(){if(!currentAdmin)return;const n=++generation;list.replaceChildren();requests.replaceChildren();members=[];app.status('listStatus','Carregando associados…');app.status('requestsStatus','Carregando solicitações…');const valid=()=>currentAdmin&&generation===n;const results=await Promise.allSettled([allRows('associados',`id,${fields},matricula,situacao,caminho_foto,foto_pendente,foto_troca_autorizada,criado_em,data_admissao`),allRows('solicitacoes_associacao',`id,${fields},situacao,criado_em`)]);if(!valid())return;if(results[0].status==='fulfilled'){members=results[0].value;$('total').textContent=members.length;$('ativos').textContent=members.filter(m=>m.situacao==='ativo').length;$('pendentes').textContent=members.filter(m=>m.situacao==='pendente').length;renderMembers();}else{for(const id of ['total','ativos','pendentes'])$(id).textContent='—';app.status('listStatus','Falha ao consultar os associados. Confira os novos campos e as permissões.','error');}if(results[1].status==='fulfilled'){const rows=results[1].value;app.status('requestsStatus',`${rows.filter(r=>r.situacao==='pendente').length} solicitações pendentes.`);if(!rows.length)requests.append(el('p','small','Nenhuma solicitação recebida.'));for(const m of rows)requests.append(makeDetails(m,true));}else app.status('requestsStatus','Não foi possível consultar solicitações.','error');}
  $('memberSearch').addEventListener('input',()=>{if(currentAdmin)renderMembers();});$('refreshButton').addEventListener('click',refresh);
  // Cadastro presencial completo, com os mesmos campos do formulário público.
  const newForm=$('newMemberForm'), createButton=$('createButton');
  const createInputs={};
  const requiredFields=new Set(['nome','cpf','data_nascimento','email','telefone','cep','endereco','numero','bairro','cidade','estado']);
  const ufs='AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE RJ RN RS RO RR SC SP SE TO'.split(' ');
  const civil=['Solteiro(a)','Casado(a)','União estável','Divorciado(a)','Viúvo(a)','Outro'];
  const existingInputs=Object.fromEntries(['nome','cpf','email','telefone'].map(key=>[key,$(key)]));
  const sections=[
    ['Dados pessoais',[
      ['nome','Nome completo',140],['cpf','CPF',14],['rg','RG',30],
      ['data_nascimento','Data de nascimento',0,'date'],['estado_civil','Estado civil',0,'select',civil],['profissao','Profissão',100]
    ]],
    ['Endereço residencial',[
      ['cep','CEP',9],['endereco','Rua / Avenida',180],['numero','Número',20],['complemento','Complemento',100],
      ['bairro','Bairro',100],['cidade','Cidade',100],['estado','Estado (UF)',0,'select',ufs]
    ]],
    ['Contato',[
      ['telefone','Telefone / WhatsApp',16,'tel'],['email','E-mail',254,'email']
    ]]
  ];
  newForm.replaceChildren();
  const cepStatus=el('p','status');cepStatus.setAttribute('role','status');
  let cepRequest=0;
  for(const [heading,schema] of sections){
    const h=el('h3','',heading);h.style.marginTop='18px';newForm.append(h);
    const grid=el('div','details-grid');newForm.append(grid);
    for(const [key,label,max,type,options] of schema){
      const group=el('div');const required=requiredFields.has(key);
      const lab=el('label','label',label+(required?' *':' (opcional)'));lab.htmlFor=key;
      const input=existingInputs[key]||el(type==='select'?'select':'input');
      input.id=key;input.name=key;input.required=required;input.autocomplete='off';
      if(type==='select'){
        const empty=el('option','','Selecionar');empty.value='';input.append(empty);
        for(const value of options){const option=el('option','',value);option.value=value;input.append(option);}
        input.style.cssText='width:100%;min-height:44px;padding:10px;border:1px solid #ccd9e7;border-radius:10px;background:#fff;color:#183353;font:inherit';
      }else{input.type=type||'text';if(max)input.maxLength=max;}
      if(key==='nome'||key==='endereco'||key==='email')group.style.gridColumn='1 / -1';
      if(key==='cpf'){
        input.inputMode='numeric';input.placeholder='000.000.000-00';
        input.addEventListener('input',()=>{let v=digits(input.value).slice(0,11);input.value=v.slice(0,3)+(v.length>3?'.'+v.slice(3,6):'')+(v.length>6?'.'+v.slice(6,9):'')+(v.length>9?'-'+v.slice(9):'');});
      }
      if(key==='data_nascimento'){const now=new Date();input.max=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');}
      if(key==='telefone'){
        input.placeholder='(21) 99999-9999';
        input.addEventListener('input',()=>{const v=digits(input.value).slice(0,11),split=v.length>10?7:6;input.value=v.length<=2?v:'('+v.slice(0,2)+') '+v.slice(2,split)+(v.length>split?'-'+v.slice(split):'');});
      }
      createInputs[key]=input;group.append(lab,input);
      if(key==='cep'){
        input.inputMode='numeric';input.placeholder='00000-000';input.pattern='[0-9]{5}-?[0-9]{3}';
        input.addEventListener('input',()=>{input.value=digits(input.value).slice(0,8).replace(/^(\d{5})(\d)/,'$1-$2');cepRequest++;cepStatus.textContent='';});
        const lookup=button('Buscar CEP',async()=>{
          if(!currentAdmin)return;
          const cep=digits(input.value);if(cep.length!==8){cepStatus.textContent='Informe um CEP com oito números.';return;}
          const ticket=++cepRequest,adminId=currentAdmin.id;lookup.disabled=true;cepStatus.textContent='Consultando CEP…';
          const valid=()=>currentAdmin?.id===adminId&&ticket===cepRequest&&digits(input.value)===cep;
          try{
            const res=await fetch('https://viacep.com.br/ws/'+cep+'/json/');if(!res.ok)throw Error();
            const data=await res.json();if(!valid())return;if(data.erro)throw Error();
            for(const [k,v] of Object.entries({endereco:data.logradouro,bairro:data.bairro,cidade:data.localidade,estado:data.uf})){if(v)createInputs[k].value=v;}
            cepStatus.textContent='Confira o endereço e informe o número.';
          }catch{if(valid())cepStatus.textContent='CEP não localizado ou serviço indisponível. Preencha o endereço manualmente.';}
          finally{lookup.disabled=false;}
        });lookup.style.marginTop='8px';group.append(lookup,cepStatus);
      }
      grid.append(group);
    }
  }
  const guidance=el('p','small','* Campos obrigatórios. Confira os dados antes de enviar o convite.');
  createButton.type='submit';newForm.append(guidance,createButton);
  newForm.addEventListener('reset',()=>{cepRequest++;cepStatus.textContent='';});
  newForm.addEventListener('submit',async e=>{
    e.preventDefault();if(!app.requireConfig('createStatus')||!currentAdmin||createButton.disabled)return;
    const body=Object.fromEntries(Object.entries(createInputs).map(([key,input])=>[key,input.value.trim()]));
    for(const key of requiredFields){if(!body[key]){app.status('createStatus','Preencha todos os campos obrigatórios.','error');createInputs[key].focus();return;}}
    if(digits(body.cpf).length!==11){app.status('createStatus','Informe o CPF com 11 números.','error');createInputs.cpf.focus();return;}
    if(!/^\d{10,11}$/.test(digits(body.telefone))){app.status('createStatus','Informe o telefone com DDD.','error');createInputs.telefone.focus();return;}
    if(!ufs.includes(body.estado)||digits(body.cep).length!==8){app.status('createStatus','Confira o CEP e o estado.','error');return;}
    body.cpf=digits(body.cpf);const adminId=currentAdmin.id;
    cepRequest++;cepStatus.textContent='';createButton.disabled=true;
    for(const input of Object.values(createInputs))input.disabled=true;
    app.status('createStatus','Enviando cadastro protegido…');
    try{
      const {data,error}=await sb.functions.invoke('criar-associado',{body});
      if(error)throw Error(await app.functionError(error));
      if(!data?.associado?.matricula)throw Error('Não foi possível confirmar o cadastro. Atualize a relação antes de tentar novamente.');
      if(currentAdmin?.id!==adminId)return;
      app.status('createStatus',`Cadastro criado: ${data.associado.matricula}. Convite enviado ao e-mail informado.`,'note ok');
      newForm.reset();await refresh();
    }catch(error){if(currentAdmin?.id===adminId)app.status('createStatus',app.errMessage(error),'error');}
    finally{createButton.disabled=false;for(const input of Object.values(createInputs))input.disabled=false;}
  });
  if(sb){const {data:{session}}=await sb.auth.getSession();if(session)await openAdmin();sb.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT'){currentAdmin=null;clear();privateArea.hidden=true;loginArea.hidden=false;}});}
})();
