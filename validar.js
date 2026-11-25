(async () => {
  const app = window.colonial;const title=document.getElementById('result');
  const description=document.getElementById('desc');const symbol=document.getElementById('symbol');
  const token=new URLSearchParams(location.search).get('t') || '';
  if (!/^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(token)) {
    symbol.textContent='!';title.textContent='Código inválido';description.textContent='Este link não contém um código de validação reconhecido.';return;
  }
  if (!app.client) {symbol.textContent='◌';title.textContent='Validação indisponível';description.textContent='A conexão com o banco ainda não foi configurada.';return;}
  const { data, error } = await app.client.rpc('validar_carteirinha',{p_token:token});
  if(error){symbol.textContent='!';title.textContent='Não foi possível verificar';description.textContent='Verifique sua conexão e tente novamente.';return;}
  if(data === true){symbol.textContent='✓';symbol.style.color='#16764d';title.textContent='Carteirinha válida';description.textContent='A associação está ATIVA no sistema do Colonial Esporte Clube.';}
  else{symbol.textContent='✕';symbol.style.color='#a92d36';title.textContent='Carteirinha não válida';description.textContent='Este código não corresponde a uma associação ativa neste momento.';}
})();
