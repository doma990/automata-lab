const NS='http://www.w3.org/2000/svg';
function node(tag,attrs={},text){const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;}
const short=(text,limit=16)=>[...text].length>limit?[...text].slice(0,limit-1).join('')+'…':text;
export class MachineGraph{
 constructor(container,{onSelect,onZoom}){this.container=container;this.onSelect=onSelect;this.onZoom=onZoom;this.scale=1;this.pan={x:0,y:0};this.lastWidth=0;this.resizeObserver=new ResizeObserver(entries=>{const width=entries[0]?.contentRect.width;if(!this.machine||!width||Math.abs(width-this.lastWidth)<2)return;this.lastWidth=width;const machine=this.machine,selected=this.selectedState,current=this.currentState,step=this.lastStep;this.draw(machine,selected);this.highlight(current,step);});this.resizeObserver.observe(container);}
 draw(machine,selectedState){
  this.machine=machine;this.selectedState=selectedState;this.scale=1;this.pan={x:0,y:0};
  const d=machine.definition,dark=document.documentElement.dataset.theme!=='light';
  const p=dark?{ink:'#d9e4ef',muted:'#93a6ba',edge:'#667b91',node:'#172435',accent:'#8de5cf',background:'#101b29'}:{ink:'#1c3146',muted:'#5c7187',edge:'#8395a8',node:'#ffffff',accent:'#167963',background:'#f5f8fb'};this.palette=p;
  const depths=new Map([[d.startState,0]]),queue=[d.startState];
  while(queue.length){const state=queue.shift();for(const target of Object.values(d.transitions[state]||{})){if(!depths.has(target)){depths.set(target,depths.get(state)+1);queue.push(target);}}}
  const deepest=Math.max(0,...depths.values());for(const state of d.states)if(!depths.has(state))depths.set(state,deepest+1);
  const layers=[];for(const state of d.states)(layers[depths.get(state)]||=[]).push(state);
  const width=Math.max(320,this.container.clientWidth||660,layers.length*80+60),height=Math.max(330,Math.max(...layers.map(l=>l?.length||0))*112+155);this.width=width;this.height=height;
  const positions=new Map();layers.forEach((layer,column)=>layer?.forEach((state,row)=>positions.set(state,{x:layers.length===1?width/2:Math.min(100,width*.225)+column*(width-Math.min(100,width*.225)-Math.min(110,width*.19))/(layers.length-1),y:height/2+(row-(layer.length-1)/2)*112})));
  const svg=node('svg',{viewBox:'0 0 '+width+' '+height,role:'group','aria-label':'Interactive state diagram for '+machine.name});
  svg.append(node('title',{},machine.name+'. Select a state to inspect its transitions.'));
  const defs=node('defs');for(const [id,color] of [['arrow',p.edge],['active-arrow',p.accent]]){const m=node('marker',{id,viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:6,markerHeight:6,orient:'auto-start-reverse'});m.append(node('path',{d:'M 0 0 L 10 5 L 0 10 z',fill:color}));defs.append(m);}svg.append(defs);
  const group=node('g');svg.append(group);this.group=group;this.svg=svg;this.edgeNodes=[];
  const start=positions.get(d.startState);group.append(node('path',{d:'M '+(start.x-72)+' '+start.y+' L '+(start.x-36)+' '+start.y,fill:'none',stroke:p.edge,'stroke-width':1.8,'marker-end':'url(#arrow)'}));
  const pairs=new Map();for(const state of d.states)for(const symbol of d.alphabet){const target=d.transitions[state][symbol],key=JSON.stringify([state,target]);if(!pairs.has(key))pairs.set(key,{from:state,to:target,symbols:[]});pairs.get(key).symbols.push(symbol);}
  for(const edge of pairs.values()){
   const a=positions.get(edge.from),b=positions.get(edge.to);let path,lx,ly;
   if(edge.from===edge.to){path='M '+(a.x-20)+' '+(a.y-24)+' C '+(a.x-68)+' '+(a.y-106)+', '+(a.x+68)+' '+(a.y-106)+', '+(a.x+21)+' '+(a.y-25);lx=a.x;ly=a.y-87;}
   else{const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy),ux=dx/len,uy=dy/len,sx=a.x+ux*35,sy=a.y+uy*35,tx=b.x-ux*37,ty=b.y-uy*37,curve=pairs.has(JSON.stringify([edge.to,edge.from]))?34:Math.abs(depths.get(edge.from)-depths.get(edge.to))>1?-120:0,cx=(sx+tx)/2-uy*curve,cy=(sy+ty)/2+ux*curve;path='M '+sx+' '+sy+' Q '+cx+' '+cy+' '+tx+' '+ty;lx=.25*sx+.5*cx+.25*tx;ly=.25*sy+.5*cy+.25*ty-10;}
   const line=node('path',{d:path,fill:'none',stroke:p.edge,'stroke-width':1.6,'marker-end':'url(#arrow)',class:'graph-edge'});group.append(line);
   group.append(node('text',{x:lx,y:ly,'text-anchor':'middle',fill:p.muted,'font-size':13,'font-family':'Consolas, monospace','paint-order':'stroke',stroke:p.background,'stroke-width':6,'stroke-linejoin':'round'},edge.symbols.map(s=>s===' '?'␠':s).join(', ')));
   this.edgeNodes.push({...edge,path:line});
  }
  this.stateNodes=new Map();for(const state of d.states){
   const {x,y}=positions.get(state),accept=d.acceptStates.includes(state),g=node('g',{'data-state':state,transform:'translate('+x+' '+y+')',role:'button',tabindex:0,'aria-label':'State '+state+(state===d.startState?', start state':'')+(accept?', accepting':'')});
   g.append(node('title',{},state+(machine.stateLabels?.[state]?': '+machine.stateLabels[state]:'')));
   const outer=node('circle',{r:31,fill:p.node,stroke:p.edge,'stroke-width':1.6});g.append(outer);
   if(accept)g.append(node('circle',{r:25,fill:'none',stroke:p.edge,'stroke-width':1.3}));
   g.append(node('text',{'text-anchor':'middle','dominant-baseline':'middle',fill:p.ink,'font-size':14,'font-family':'Consolas, monospace'},short(state,6)));
   if(machine.stateLabels?.[state])g.append(node('text',{y:53,'text-anchor':'middle',fill:p.muted,'font-size':12,'font-family':'Consolas, monospace'},short(machine.stateLabels[state])));
   const select=()=>{this.selectedState=state;this.onSelect(state);};g.addEventListener('click',select);g.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();select();}});
   group.append(g);this.stateNodes.set(state,{node:g,outer});
  }
  let drag=null;svg.addEventListener('pointerdown',event=>{if(event.target.closest('[data-state]'))return;drag={x:event.clientX,y:event.clientY,panX:this.pan.x,panY:this.pan.y};svg.setPointerCapture(event.pointerId);});
  svg.addEventListener('pointermove',event=>{if(!drag)return;const factor=width/svg.getBoundingClientRect().width;this.pan={x:drag.panX+(event.clientX-drag.x)*factor,y:drag.panY+(event.clientY-drag.y)*factor};this.updateTransform();});
  svg.addEventListener('pointerup',()=>{drag=null;});svg.addEventListener('pointercancel',()=>{drag=null;});
  this.container.replaceChildren(svg);this.highlight(d.startState);this.updateTransform();
 }
 updateTransform(){this.group?.setAttribute('transform','translate('+(this.width/2*(1-this.scale)+this.pan.x)+' '+(this.height/2*(1-this.scale)+this.pan.y)+') scale('+this.scale+')');this.onZoom?.(Math.round(this.scale*100));}
 zoom(amount){this.scale=Math.min(8,Math.max(.4,this.scale*amount));this.updateTransform();}
 fit(){this.scale=1;this.pan={x:0,y:0};this.updateTransform();}
 highlight(current,step=null){this.currentState=current;this.lastStep=step;for(const [state,{node:g,outer}] of this.stateNodes||[]){const active=state===current;outer.setAttribute('stroke',active?this.palette.accent:this.palette.edge);outer.setAttribute('fill',active?(document.documentElement.dataset.theme==='light'?'#e3f4ee':'#203d3b'):this.palette.node);outer.setAttribute('stroke-width',active?2.5:1.6);g.setAttribute('aria-pressed',state===this.selectedState?'true':'false');}for(const edge of this.edgeNodes||[]){const active=step&&edge.from===step.from&&edge.to===step.to&&edge.symbols.includes(step.symbol);edge.path.setAttribute('stroke',active?this.palette.accent:this.palette.edge);edge.path.setAttribute('stroke-width',active?2.7:1.6);edge.path.setAttribute('marker-end',active?'url(#active-arrow)':'url(#arrow)');}}
 exportSvg(){const clone=this.svg.cloneNode(true);clone.setAttribute('xmlns',NS);clone.setAttribute('width',this.width);clone.setAttribute('height',this.height);clone.insertBefore(node('rect',{width:this.width,height:this.height,fill:this.palette.background}),clone.children[1]);clone.querySelector('g').removeAttribute('transform');return new XMLSerializer().serializeToString(clone);}
}
