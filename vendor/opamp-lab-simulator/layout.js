/* Progressive layout behavior; no circuit or instrument state changes. */
(() => {
  const guide=document.getElementById('pinGuide');
  if(matchMedia('(max-width:760px)').matches)guide.open=false;
  const editor=document.getElementById('selectedComponentEditor');
  let selection='',expanded={};
  function groupSettings() {
    const current=document.getElementById('componentList').value;
    if(current!==selection){expanded={};selection=current;}
    if(editor.querySelector('.editor-advanced'))return;
    const groups=[
      ['Exact position',['.position-fields','#applyPosition','#editColumn']],
      ['Advanced model',['#editGain','#editSlew']]
    ];
    for(const [title,selectors] of groups){
      const nodes=selectors.flatMap(selector=>[...editor.querySelectorAll(selector)]).map(node=>node.matches('input')?node.closest('label'):node);
      if(!nodes.length)continue;
      const details=document.createElement('details');details.className='editor-advanced';details.open=!!expanded[title];
      const summary=document.createElement('summary');summary.textContent=title;details.append(summary);
      nodes[0].before(details);nodes.forEach(node=>details.append(node));
      details.addEventListener('toggle',()=>{if(selection===current)expanded[title]=details.open;});
    }
  }
  new MutationObserver(groupSettings).observe(editor,{childList:true});
  groupSettings();
})();
