import * as CONST from "../project3/const.js";
const {DATA_PATH, NAME_MAP, CORE_CHARS, CHAR_COL, IGNORE_WORDS, SEASON_EPS, ALL_EPS, EMO_COL, THEMES_FULL, THEME_COL, THEME_KW, LAWYER_W, VIGIL_W, STOP, S, TT} = CONST;

// Loading overlay
(function(){
  const o=document.createElement("div");o.id="loading-overlay";
  o.innerHTML='<div class="ld-spin"></div><div class="ld-text">Loading…</div>';
  document.body.prepend(o);
})();

function showTT(evt,html){TT.innerHTML=html;TT.classList.add("show");TT.style.left=(evt.clientX+12)+"px";TT.style.top=(evt.clientY-20)+"px";}
function hideTT(){TT.classList.remove("show");}

Promise.all([d3.csv(DATA_PATH+"line_data.csv"),d3.csv(DATA_PATH+"scene_data.csv")])
.then(([lr,sr])=>{
  S.lines=preprocessLines(lr);
  S.scenes=preprocessScenes(sr);
  findFirstMF();
  populateCharSel();
  setupControls();
  setupFade();
  renderAll();
  document.getElementById("loading-overlay").classList.add("hidden");
}).catch(err=>{
  console.error("Data load failed:",err);
  document.querySelector(".ld-text").textContent="Error — check console";
});

function canon(raw){
  if(!raw) return null;
  const l=raw.trim().toLowerCase();
  if(NAME_MAP[l]) return NAME_MAP[l];
  for(const[k,v] of Object.entries(NAME_MAP)) if(l.includes(k)||k.includes(l)) return v;
  return raw.trim().replace(/\b\w/g,c=>c.toUpperCase());
}
function preprocessLines(raw){
  return raw.map(d=>({ep:d.episode,season:+d.season,sid:d.scene_id,loc:d.location,
    speaker:canon(d.normalized_speaker||d.speaker),line:(d.line||"").trim(),turn:+d.conversation_turn}))
    .filter(d=>d.speaker&&d.line);
}
function preprocessScenes(raw){
  return raw.map(d=>{
    let sc={};try{sc=JSON.parse((d.emotion_scores||"{}").replace(/""/g,'"'));}catch(e){}
    return{ep:d.episode,season:+d.season,sid:d.scene_id,loc:d.location,
      text:d.scene_text||"",emo:(d.dominant_emotion||"unknown").toLowerCase().trim(),scores:sc};
  });
}
function findFirstMF(){
  for(let i=0;i<ALL_EPS.length;i++){
    const ep=ALL_EPS[i];
    const ls=S.lines.filter(d=>d.ep===ep);
    const byScene=d3.group(ls,d=>d.sid);
    for(const[sid,arr] of byScene.entries()){
      const sp=new Set(arr.map(d=>d.speaker));
      if(sp.has("Matt Murdock")&&sp.has("Wilson Fisk")){S.firstMF={ep,sid,idx:i+1};return;}
    }
  }
}

// FILTERS
function fLines(){
  let d=S.lines;
  if(S.season!=="all") d=d.filter(r=>r.season===+S.season);
  if(S.epIdx>0){const e=getEpCode(S.epIdx);d=d.filter(r=>r.ep===e);}
  if(S.char!=="all") d=d.filter(r=>r.speaker===S.char);
  return d;
}
function fScenes(){
  let d=S.scenes;
  if(S.season!=="all") d=d.filter(r=>r.season===+S.season);
  if(S.epIdx>0){const e=getEpCode(S.epIdx);d=d.filter(r=>r.ep===e);}
  return d;
}
function getEpCode(idx){
  if(S.season!=="all"){const s=+S.season;return `S0${s}E${idx<10?"0"+idx:idx}`;}
  return ALL_EPS[idx-1]||"";
}
function getEpsForSeason(){
  if(S.season!=="all"){const s=+S.season;return ALL_EPS.filter(e=>e.startsWith(`S0${s}`));}
  return ALL_EPS;
}


function populateCharSel(){
  const sel=document.getElementById("character-selector");
  const counts=d3.rollup(S.lines,v=>v.length,d=>d.speaker);
  [...counts.entries()].filter(([k])=>CORE_CHARS.includes(k)).sort((a,b)=>b[1]-a[1])
    .forEach(([n])=>{const o=document.createElement("option");o.value=n;o.textContent=n;sel.appendChild(o);});
}
function setupControls(){
  document.getElementById("season-btns").addEventListener("click",e=>{
    const b=e.target.closest(".btn-pill");if(!b)return;
    document.querySelectorAll("#season-btns .btn-pill").forEach(x=>x.classList.remove("active"));
    b.classList.add("active");S.season=b.dataset.season;
    const sl=document.getElementById("episode-slider");
    sl.max=S.season==="all"?ALL_EPS.length:SEASON_EPS[+S.season];sl.value=0;S.epIdx=0;
    updateEpLabel();renderAll();
  });
  document.getElementById("episode-slider").addEventListener("input",e=>{
    S.epIdx=+e.target.value;updateEpLabel();renderAll();
  });
  document.getElementById("character-selector").addEventListener("change",e=>{
    S.char=e.target.value;renderAll();
  });
  document.getElementById("lawyer-btn").addEventListener("click",()=>setMode("lawyer"));
  document.getElementById("vigilante-btn").addEventListener("click",()=>setMode("vigilante"));
  document.getElementById("play-btn").addEventListener("click",togglePlay);
  document.getElementById("reset-btn").addEventListener("click",()=>{
    stopPlay();
    document.getElementById("net-progress-bar").style.width="0%";
    renderNetwork();
  });
  updateEpLabel();
}
function updateEpLabel(){
  const l=document.getElementById("ep-label");
  l.textContent=S.epIdx===0?"All":getEpCode(S.epIdx);
}
function setMode(m){
  S.mode=m;
  document.getElementById("lawyer-btn").classList.toggle("active",m==="lawyer");
  document.getElementById("vigilante-btn").classList.toggle("active",m==="vigilante");
  renderIdentity();renderWordCloud();renderWordFreq();
}
function renderAll(){
  renderBar();renderHeatmap();renderNetwork();
  renderWordCloud();renderWordFreq();renderWordTrend();
  renderIdentity();renderThemes();renderEmotion();
}


function renderBar(){
  const ct=document.getElementById("bar-chart");ct.innerHTML="";
  const lines=fLines();
  const counts=d3.rollup(lines,v=>v.length,d=>d.speaker);
  let data=[...counts.entries()].filter(([k])=>CORE_CHARS.includes(k))
    .sort((a,b)=>b[1]-a[1]).slice(0,10);
  if(!data.length){ct.innerHTML='<div class="no-data">No data</div>';return;}

  const W=ct.clientWidth||500,H=260;
  const m={top:16,right:16,bottom:80,left:48},w=W-m.left-m.right,h=H-m.top-m.bottom;
  const svg=d3.select(ct).append("svg").attr("width",W).attr("height",H);
  const g=svg.append("g").attr("transform",`translate(${m.left},${m.top})`);

  const x=d3.scaleBand().domain(data.map(d=>d[0])).range([0,w]).padding(.3);
  const y=d3.scaleLinear().domain([0,d3.max(data,d=>d[1])]).nice().range([h,0]);

  g.append("g").attr("class","axis").attr("transform",`translate(0,${h})`)
    .call(d3.axisBottom(x)).selectAll("text")
    .attr("transform","rotate(-35)").attr("text-anchor","end").style("font-size","9px");
  g.append("g").attr("class","axis").call(d3.axisLeft(y).ticks(5));

  g.selectAll(".bar-rect").data(data).join("rect").attr("class","bar-rect")
    .attr("x",d=>x(d[0])).attr("width",x.bandwidth())
    .attr("y",h).attr("height",0).attr("fill",d=>CHAR_COL[d[0]]||"#ff2a2a").attr("rx",3)
    .on("mousemove",(ev,d)=>showTT(ev,`<div class="tt-name">${d[0]}</div><div class="tt-row">Lines: <span>${d[1]}</span></div>`))
    .on("mouseleave",hideTT)
    .on("click",(ev,d)=>{S.char=d[0];document.getElementById("character-selector").value=d[0];renderAll();})
    .transition().duration(600).ease(d3.easeCubicOut)
    .attr("y",d=>y(d[1])).attr("height",d=>h-y(d[1]));

  g.selectAll(".bar-label").data(data).join("text")
    .attr("x",d=>x(d[0])+x.bandwidth()/2).attr("y",d=>y(d[1])-3)
    .attr("text-anchor","middle").attr("fill","#555").attr("font-size","8px")
    .text(d=>d[1]).attr("opacity",0).transition().delay(400).duration(300).attr("opacity",1);
}

function renderHeatmap(){
  const ct=document.getElementById("heatmap-chart");ct.innerHTML="";
  const episodes=getEpsForSeason();
  const chars=S.char==="all" ? CORE_CHARS.slice(0,10) : [S.char].filter(ch=>CORE_CHARS.includes(ch));
  if(!chars.length){ct.innerHTML='<div class="no-data">No data</div>';return;}
  const cntMap={};
  const sourceLines=S.char==="all" ? S.lines : S.lines.filter(d=>d.speaker===S.char);
  sourceLines.forEach(d=>{
    if(!chars.includes(d.speaker)||!episodes.includes(d.ep))return;
    const k=d.speaker+"|||"+d.ep;cntMap[k]=(cntMap[k]||0)+1;
  });

  const W=ct.clientWidth||500,H=260;
  const m={top:8,right:12,bottom:44,left:100},w=W-m.left-m.right,h=H-m.top-m.bottom;
  const svg=d3.select(ct).append("svg").attr("width",W).attr("height",H);
  const g=svg.append("g").attr("transform",`translate(${m.left},${m.top})`);

  const x=d3.scaleBand().domain(episodes).range([0,w]).padding(.05);
  const y=d3.scaleBand().domain(chars).range([0,h]).padding(.1);
  const maxV=d3.max(Object.values(cntMap))||1;
  const col=d3.scaleSequential().domain([0,maxV]).interpolator(d3.interpolateRgb("#150000","#ff2a2a"));

  const step=Math.max(1,Math.ceil(episodes.length/10));
  g.append("g").attr("class","axis").attr("transform",`translate(0,${h})`)
    .call(d3.axisBottom(x).tickValues(episodes.filter((_,i)=>i%step===0)))
    .selectAll("text").attr("transform","rotate(-35)").attr("text-anchor","end").style("font-size","8px");
  g.append("g").attr("class","axis").call(d3.axisLeft(y).tickSize(0)).selectAll("text").style("font-size","9px");

  const cells=[];
  chars.forEach(ch=>episodes.forEach(ep=>{const v=cntMap[ch+"|||"+ep]||0;cells.push({ch,ep,v});}));

  g.selectAll(".heatmap-cell").data(cells).join("rect").attr("class","heatmap-cell")
    .attr("x",d=>x(d.ep)).attr("y",d=>y(d.ch)).attr("width",x.bandwidth()).attr("height",y.bandwidth())
    .attr("fill",d=>d.v>0?col(d.v):"#0f0f0f").attr("opacity",d=>d.v>0?.85:.25).attr("rx",1.5)
    .on("mousemove",(ev,d)=>showTT(ev,`<div class="tt-name">${d.ch}</div><div class="tt-row">Ep: <span>${d.ep}</span></div><div class="tt-row">Lines: <span>${d.v}</span></div>`))
    .on("mouseleave",hideTT);
}


// Pre-compute per-episode edge/node data so play just reveals them (CURSOR REWORKED MY ORIGINAL CODE BECAUSE MY ORIGINAL CODE GAVE ME MOTION SICKNESS BECAUSE OF THE JUMPY MOVEMENTS)
function buildFullNetData(){
  const emoMap=new Map(S.scenes.map(s=>[s.sid,s.emo]));
  let lines=S.lines;
  if(S.season!=="all") lines=lines.filter(d=>d.season===+S.season);

  // Per-episode: which characters appear & which edges form
  const nodeFirstEp={};   // char -> earliest episode index (0-based)
  const edgeFirstEp={};   // "A|||B" -> earliest episode index
  const edgeEmo={};       // "A|||B" -> {emo: count}
  const edgeCounts={};    // "A|||B" -> total count
  const charLines={};     // char -> total lines

  const eps=getEpsForSeason();
  eps.forEach((ep,epI)=>{
    const epLines=lines.filter(d=>d.ep===ep);
    const byScene=d3.group(epLines,d=>d.sid);

    epLines.forEach(d=>{
      if(!CORE_CHARS.includes(d.speaker)) return;
      charLines[d.speaker]=(charLines[d.speaker]||0)+1;
      if(nodeFirstEp[d.speaker]===undefined) nodeFirstEp[d.speaker]=epI;
    });

    byScene.forEach(sl=>{
      const sp=[...new Set(sl.map(d=>d.speaker))].filter(s=>CORE_CHARS.includes(s));
      const em=emoMap.get(sl[0].sid)||"unknown";
      for(let i=0;i<sp.length;i++) for(let j=i+1;j<sp.length;j++){
        const[a,b]=sp[i]<sp[j]?[sp[i],sp[j]]:[sp[j],sp[i]];
        const k=a+"|||"+b;
        edgeCounts[k]=(edgeCounts[k]||0)+1;
        if(!edgeEmo[k]) edgeEmo[k]={};
        edgeEmo[k][em]=(edgeEmo[k][em]||0)+1;
        if(edgeFirstEp[k]===undefined) edgeFirstEp[k]=epI;
      }
    });
  });

  // Build final node list (all core characters present in current filter)
  const nodes=Object.entries(charLines)
    .sort((a,b)=>b[1]-a[1])
    .map(([id,lines])=>({id,lines,color:CHAR_COL[id]||"#555",firstEp:nodeFirstEp[id]||0}));
  const ns=new Set(nodes.map(n=>n.id));

  const maxEdge=d3.max(Object.values(edgeCounts))||1;

  const edges=Object.entries(edgeCounts)
    .map(([k,cnt])=>{
      const[a,b]=k.split("|||");
      const ec=edgeEmo[k]||{};
      const em=Object.keys(ec).length?Object.entries(ec).sort((x,y)=>y[1]-x[1])[0][0]:"unknown";
      return{source:a,target:b,count:cnt,emotion:em,firstEp:edgeFirstEp[k]||0};
    })
    // Keep even single-scene interactions so sparse but important links still appear.
    .filter(e=>ns.has(e.source)&&ns.has(e.target)&&e.count>0)
    // Keep a generous cap to avoid dropping meaningful relationships.
    .sort((a,b)=>b.count-a.count).slice(0,120);

  return{nodes,edges,maxEdge,totalEps:eps.length,eps};
}

function renderNetwork(){
  const container=document.querySelector(".net-wrap");
  const svgEl=document.getElementById("network-svg");
  const W=container.clientWidth||800, H=480;
  S.netW=W;S.netH=H;

  const full=buildFullNetData();
  if(!full.nodes.length) return;
  S.netFull=full;

  const{nodes,edges,maxEdge}=full;
  const maxLines=d3.max(nodes,d=>d.lines)||1;
  const rScale=d3.scaleSqrt().domain([0,maxLines]).range([5,24]);
  const wScale=d3.scaleLinear().domain([0,maxEdge]).range([.5,6]).clamp(true);
  const oScale=d3.scaleLinear().domain([0,maxEdge]).range([.15,.7]).clamp(true);
  S.netScales={rScale,wScale,oScale};

  // First time loading the network
  if(!S.netInitialized){
    const svg=d3.select(svgEl).attr("width",W).attr("height",H).attr("viewBox",`0 0 ${W} ${H}`);
    const defs=svg.append("defs");
    const bg=defs.append("radialGradient").attr("id","nbg");
    bg.append("stop").attr("offset","0%").attr("stop-color","#1a0000").attr("stop-opacity",".3");
    bg.append("stop").attr("offset","100%").attr("stop-color","#0b0b0b").attr("stop-opacity","1");
    svg.append("rect").attr("width",W).attr("height",H).attr("fill","url(#nbg)");
    const g=svg.append("g");
    svg.call(d3.zoom().scaleExtent([.4,3]).on("zoom",e=>g.attr("transform",e.transform)));
    g.append("g").attr("class","edge-layer");
    g.append("g").attr("class","radar-layer");
    g.append("g").attr("class","node-layer");
    S.netG=g;S.netSVG=svg;
    S.netInitialized=true;
  }

// This is for smooth animation
  const oldPos={};
  (S.netNodes||[]).forEach(n=>{if(n.x!==undefined) oldPos[n.id]={x:n.x,y:n.y};});
  nodes.forEach(n=>{
    if(oldPos[n.id]){n.x=oldPos[n.id].x;n.y=oldPos[n.id].y;}
    if(n.id==="Matt Murdock"){n.fx=W*.22;n.fy=H*.5;}
    else if(n.id==="Wilson Fisk"){n.fx=W*.78;n.fy=H*.5;}
  });
  S.netNodes=nodes;S.netEdges=edges;

  const g=S.netG;

  // Build ALL edges 
  g.select(".edge-layer").selectAll(".net-edge").remove();
  const linkAll=g.select(".edge-layer").selectAll(".net-edge")
    .data(edges,d=>d.source+"|||"+d.target)
    .join("line")
    .attr("class","net-edge")
    .attr("stroke",d=>EMO_COL[d.emotion]||"#444")
    .attr("stroke-width",d=>wScale(d.count))
    .attr("stroke-opacity",d=>oScale(d.count))
    .on("mousemove",(ev,d)=>{
      const src=d.source.id||d.source;
      const tgt=d.target.id||d.target;
      showTT(ev,`<div class="tt-name">${src} ↔ ${tgt}</div>
        <div class="tt-row">Interaction count: <span>${d.count}</span></div>
        <div class="tt-row">Dominant emotion: <span style="color:${EMO_COL[d.emotion]||"#aaa"}">${d.emotion}</span></div>`);
    })
    .on("mouseleave",hideTT);
  linkAll.classed("mf-focus",d=>{
    const si=d.source.id||d.source,ti=d.target.id||d.target;
    return(si==="Matt Murdock"&&ti==="Wilson Fisk")||(si==="Wilson Fisk"&&ti==="Matt Murdock");
  });
  S.netLinks=linkAll;

  // --- Build ALL nodes ---
  g.select(".node-layer").selectAll(".network-node").remove();
  const nodeAll=g.select(".node-layer").selectAll(".network-node")
    .data(nodes,d=>d.id)
    .join("g")
    .attr("class","network-node");

  nodeAll.append("circle")
    .attr("r",d=>rScale(d.lines))
    .attr("fill",d=>d.color).attr("fill-opacity",.85)
    .attr("stroke",d=>d.id==="Matt Murdock"?"#ff2a2a":d.id==="Wilson Fisk"?"#8b0000":"none")
    .attr("stroke-width",d=>(d.id==="Matt Murdock"||d.id==="Wilson Fisk")?2:0);

  nodeAll.append("text").attr("text-anchor","middle").attr("fill","#bbb")
    .attr("dy",d=>rScale(d.lines)+11)
    .attr("font-size",d=>(d.id==="Matt Murdock"||d.id==="Wilson Fisk")?"10px":"8px")
    .attr("font-weight",d=>(d.id==="Matt Murdock"||d.id==="Wilson Fisk")?"700":"400")
    .text(d=>d.id.split(" ")[0]);
  S.netNodeSel=nodeAll;

  // Drag around cause it's fun and makes it interactive
  nodeAll.call(d3.drag()
    .on("start",(ev,d)=>{if(!ev.active&&S.netSim) S.netSim.alphaTarget(.3).restart();if(!d.fx){d.fx=d.x;d.fy=d.y;}})
    .on("drag",(ev,d)=>{if(d.id!=="Matt Murdock"&&d.id!=="Wilson Fisk"){d.fx=ev.x;d.fy=ev.y;}})
    .on("end",(ev,d)=>{if(!ev.active&&S.netSim) S.netSim.alphaTarget(0);if(d.id!=="Matt Murdock"&&d.id!=="Wilson Fisk"){d.fx=null;d.fy=null;}})
  );

  // Hover
  nodeAll.on("mousemove",(ev,d)=>{
    showTT(ev,`<div class="tt-name">${d.id}</div><div class="tt-row">Lines: <span>${d.lines}</span></div>`);
    linkAll.classed("highlighted",e=>(e.source.id||e.source)===d.id||(e.target.id||e.target)===d.id)
           .classed("faded",e=>(e.source.id||e.source)!==d.id&&(e.target.id||e.target)!==d.id);
  }).on("mouseleave",()=>{
    hideTT();linkAll.classed("highlighted",false).classed("faded",false);
  }).on("click",(ev,d)=>{
    S.char=d.id;document.getElementById("character-selector").value=d.id;renderAll();
  });

  // TIMELINE Simulation 
  if(S.netSim) S.netSim.stop();
  const midX=W/2,midY=H/2;
  S.netSim=d3.forceSimulation(nodes)
    .force("link",d3.forceLink(edges).id(d=>d.id)
      .distance(d=>{
        const s=d.source.id||d.source,t=d.target.id||d.target;
        const isMF=(s==="Matt Murdock"&&t==="Wilson Fisk")||(s==="Wilson Fisk"&&t==="Matt Murdock");
        if(isMF) return W*0.45;
        return 120+(Math.max(0,8-d.count)*7);
      })
      .strength(d=>{
        const s=d.source.id||d.source,t=d.target.id||d.target;
        const isMF=(s==="Matt Murdock"&&t==="Wilson Fisk")||(s==="Wilson Fisk"&&t==="Matt Murdock");
        if(isMF) return .95;
        return .38;
      }))
    .force("charge",d3.forceManyBody().strength(-420))
    .force("center",d3.forceCenter(midX,midY))
    .force("x",d3.forceX(midX).strength(.03))
    .force("y",d3.forceY(midY).strength(.03))
    // Push non-anchor nodes into a ring around the Matt-Fisk axis center.
    .force("radial",d3.forceRadial(d=>(d.id==="Matt Murdock"||d.id==="Wilson Fisk")?0:Math.min(W,H)*0.22,midX,midY).strength(.22))
    .force("collide",d3.forceCollide(d=>rScale(d.lines)+12))
    .alpha(.5).alphaDecay(.03);

  S.netSim.on("tick",()=>{
    linkAll.attr("x1",d=>clamp(d.source.x,16,W-16)).attr("y1",d=>clamp(d.source.y,16,H-16))
           .attr("x2",d=>clamp(d.target.x,16,W-16)).attr("y2",d=>clamp(d.target.y,16,H-16));
    nodeAll.attr("transform",d=>`translate(${clamp(d.x,16,W-16)},${clamp(d.y,16,H-16)})`);
  });

  document.getElementById("net-ep-label").textContent="All Episodes";
  document.getElementById("net-info").textContent="";
}

// Reveal only nodes/edges that exist up to a given episode index
function revealUpToEp(epI){
  if(!S.netLinks||!S.netNodeSel) return;

  S.netNodeSel.transition().duration(400).ease(d3.easeCubicOut)
    .attr("opacity",d=>d.firstEp<=epI?1:0.06);

  S.netLinks.transition().duration(400).ease(d3.easeCubicOut)
    .attr("stroke-opacity",d=>{
      if(d.firstEp>epI) return 0;
      return S.netScales.oScale(d.count);
    })
    .attr("stroke-width",d=>{
      if(d.firstEp>epI) return 0;
      return S.netScales.wScale(d.count);
    });

  const total=S.netFull.totalEps;
  const ep=S.netFull.eps[Math.min(epI,total-1)];
  document.getElementById("net-ep-label").textContent=`Up to ${ep}`;
  document.getElementById("net-progress-bar").style.width=((epI+1)/total*100)+"%";

  // First Matt–Fisk interaction
  const info=document.getElementById("net-info");
  info.textContent="";
  S.netLinks.classed("highlight-pulse",false);
  if(S.firstMF){
    const mfIdx=S.firstMF.idx-1; // 0-based
    if(epI>=mfIdx){
      info.textContent=`First Matt–Fisk interaction: ${S.firstMF.ep}`;
    }
  }
}

// Play animation 
function togglePlay(){if(S.playing) stopPlay(); else startPlay();}

function startPlay(){
  S.playing=true;S.playEpIdx=0;
  document.getElementById("play-label").textContent="Pause";
  document.getElementById("net-progress-bar").style.width="0%";

  // Make sure the full graph is built first
  if(!S.netFull) renderNetwork();

  function step(){
    if(!S.playing) return;
    revealUpToEp(S.playEpIdx);
    S.playEpIdx++;
    if(S.playEpIdx>=S.netFull.totalEps){stopPlay();return;}
    S.playTimer=setTimeout(step,900);
  }
  step();
}

function stopPlay(){
  S.playing=false;
  clearTimeout(S.playTimer);
  document.getElementById("play-label").textContent="Play";
  document.getElementById("net-info").textContent="";
  if(S.netLinks) S.netLinks.classed("highlight-pulse",false);
}

function getWords(ch,topN=60){
  let lines=ch&&ch!=="all"?S.lines.filter(d=>d.speaker===ch):fLines();
  const freq={};
  lines.forEach(d=>{
    d.line.toLowerCase().replace(/[^a-z\s']/g," ").split(/\s+/).forEach(w=>{
      const c=w.replace(/^'+|'+$/g,"");
      const normalized=c
        .replace(/'s$/,"")   // fisk's -> fisk
        .replace(/s'$/,"s")  // bosses' -> bosses
        .replace(/'/g,"");   // don't -> dont
      const singular=normalized.endsWith("s") ? normalized.slice(0,-1) : normalized;

      if(normalized.length<=2) return;
      if(
        STOP.has(normalized) || STOP.has(singular) ||
        IGNORE_WORDS.has(normalized) || IGNORE_WORDS.has(singular)
      ) return;
      freq[normalized]=(freq[normalized]||0)+1;
    });
  });
  return Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,topN).map(([w,c])=>({word:w,count:c}));
}

function renderWordCloud(){
  const ct=document.getElementById("wordcloud-area");ct.innerHTML="";
  const ch=S.char!=="all"?S.char:"Matt Murdock";
  const words=getWords(ch,50);if(!words.length)return;
  const W=ct.clientWidth||340,H=260;
  const svg=d3.select(ct).append("svg").attr("width",W).attr("height",H);
  const maxC=words[0].count;
  const fs=d3.scaleSqrt().domain([1,maxC]).range([9,32]);
  const color=d3.scaleSequential().domain([0,words.length]).interpolator(d3.interpolateRgb("#ff2a2a","#ff9999"));
  const placed=[];const cx=W/2,cy=H/2;

  words.forEach((w,i)=>{
    const f=fs(w.count),wL=w.word.length*f*.56,wH=f*1.1;
    let x,y,angle=0,r=0,ok=false;
    for(let it=0;it<400;it++){
      angle+=.4;r=it*1.1;
      x=cx+r*Math.cos(angle)-wL/2;y=cy+r*Math.sin(angle)+f/3;
      if(x<2||x+wL>W-2||y-f>H-2||y<2) continue;
      const box={x,y:y-f,w:wL,h:wH};
      ok=!placed.some(p=>!(box.x+box.w<p.x||p.x+p.w<box.x||box.y+box.h<p.y||p.y+p.h<box.y));
      if(ok){placed.push(box);break;}
    }
    if(ok) svg.append("text").attr("class","wc-word").attr("x",x+wL/2).attr("y",y)
      .attr("text-anchor","middle").attr("font-size",f).attr("fill",color(i))
      .attr("font-weight",i<4?"700":"400").text(w.word);
  });
}

// FREQUENCY 
function renderWordFreq(){
  const ct=document.getElementById("wordfreq-chart");ct.innerHTML="";
  const ch=S.char!=="all"?S.char:"Matt Murdock";
  const words=getWords(ch,12);if(!words.length)return;
  const W=ct.clientWidth||340,H=260;
  const m={top:12,right:16,bottom:12,left:80},w=W-m.left-m.right,h=H-m.top-m.bottom;
  const svg=d3.select(ct).append("svg").attr("width",W).attr("height",H);
  const g=svg.append("g").attr("transform",`translate(${m.left},${m.top})`);
  const x=d3.scaleLinear().domain([0,words[0].count]).nice().range([0,w]);
  const y=d3.scaleBand().domain(words.map(d=>d.word)).range([0,h]).padding(.22);
  g.append("g").attr("class","axis").call(d3.axisLeft(y).tickSize(0)).select(".domain").remove();
  const col=d3.scaleSequential().domain([0,words.length]).interpolator(d3.interpolateRgb("#ff2a2a","#8b0000"));

  g.selectAll(".freq-bar").data(words).join("rect").attr("class","freq-bar bar-rect")
    .attr("x",0).attr("y",d=>y(d.word)).attr("height",y.bandwidth()).attr("fill",(d,i)=>col(i)).attr("rx",2)
    .attr("width",0).transition().duration(500).ease(d3.easeCubicOut).attr("width",d=>x(d.count));

  g.selectAll(".freq-label").data(words).join("text")
    .attr("x",d=>x(d.count)+3).attr("y",d=>y(d.word)+y.bandwidth()/2+3)
    .attr("fill","#555").attr("font-size","8px").text(d=>d.count);
}

//TREND
function renderWordTrend(){
  const ct=document.getElementById("wordtrend-chart");ct.innerHTML="";
  const kwCt=document.getElementById("word-trend-keywords");kwCt.innerHTML="";
  const allKW=["justice","violence","fear","god","devil","kill","save","blind","truth"];
  allKW.forEach((w,i)=>{
    const c=document.createElement("span");
    c.className="kw-chip"+(S.trendWords.has(w)?" active":"");
    c.textContent=w;c.style.borderColor=d3.schemeTableau10[i%10];c.style.color=d3.schemeTableau10[i%10];
    c.style.background=S.trendWords.has(w)?d3.schemeTableau10[i%10]+"22":"transparent";
    c.addEventListener("click",()=>{if(S.trendWords.has(w))S.trendWords.delete(w);else S.trendWords.add(w);renderWordTrend();});
    kwCt.appendChild(c);
  });
  const active=allKW.filter(w=>S.trendWords.has(w));if(!active.length)return;
  const epData=ALL_EPS.map(ep=>{
    const ls=S.lines.filter(d=>d.ep===ep);
    const tot=ls.reduce((s,d)=>s+d.line.split(/\s+/).length,0)||1;
    const n={ep};active.forEach(w=>{let c=0;ls.forEach(d=>{c+=d.line.toLowerCase().split(/\s+/).filter(t=>t.includes(w)).length;});n[w]=(c/tot)*1000;});
    return n;
  });
  const W=ct.clientWidth||340,H=180;
  const m={top:8,right:12,bottom:32,left:34},w=W-m.left-m.right,h=H-m.top-m.bottom;
  const svg=d3.select(ct).append("svg").attr("width",W).attr("height",H);
  const g=svg.append("g").attr("transform",`translate(${m.left},${m.top})`);
  const x=d3.scalePoint().domain(ALL_EPS).range([0,w]);
  const maxY=d3.max(epData.flatMap(d=>active.map(k=>d[k])))||1;
  const y=d3.scaleLinear().domain([0,maxY]).nice().range([h,0]);

  g.append("g").attr("class","axis").attr("transform",`translate(0,${h})`)
    .call(d3.axisBottom(x).tickValues(["S01E01","S02E01","S03E01"]).tickFormat(d=>d==="S01E01"?"S1":d==="S02E01"?"S2":"S3"));
  g.append("g").attr("class","axis").call(d3.axisLeft(y).ticks(3));

  ["S02E01","S03E01"].forEach(ep=>{
    g.append("line").attr("x1",x(ep)).attr("x2",x(ep)).attr("y1",0).attr("y2",h).attr("stroke","#222").attr("stroke-dasharray","3,3");
  });

  active.forEach((kw,i)=>{
    const ln=d3.line().x(d=>x(d.ep)).y(d=>y(d[kw])).curve(d3.curveMonotoneX);
    g.append("path").datum(epData).attr("class","trend-line")
      .attr("stroke",d3.schemeTableau10[allKW.indexOf(kw)%10]).attr("d",ln);
  });
}

// DENTITY TIMELINE
function idScore(ep){
  const ls=S.lines.filter(d=>d.ep===ep&&d.speaker==="Matt Murdock");
  let law=0,vig=0;
  ls.forEach(d=>{const t=d.line.toLowerCase().split(/\s+/);
    law+=t.filter(x=>LAWYER_W.some(w=>x.includes(w))).length;
    vig+=t.filter(x=>VIGIL_W.some(w=>x.includes(w))).length;
  });
  const tot=law+vig;return tot===0?.5:law/tot;
}

function renderIdentity(){
  const ct=document.getElementById("identity-timeline");ct.innerHTML="";

  const seasons=[1,2,3];
  if(S.season!=="all") seasons.splice(0,seasons.length,+S.season);

  const W=ct.clientWidth||900;
  const rowH=32,gap=28,topPad=12;
  const H=topPad+seasons.length*(rowH+gap)+10;
  const m={left:64,right:20};
  const w=W-m.left-m.right;

  const svg=d3.select(ct).append("svg").attr("width",W).attr("height",H);

  const colorScale=d3.scaleLinear().domain([0,.35,.65,1]).range(["#ff2a2a","#9b59b6","#9b59b6","#4a9eff"]).clamp(true);

  let avgScores={};

  seasons.forEach((sn,ri)=>{
    const eps=ALL_EPS.filter(e=>e.startsWith(`S0${sn}`));
    const scores=eps.map(ep=>({ep,score:idScore(ep)}));
    const bW=w/scores.length;
    const yOff=topPad+ri*(rowH+gap);

    // Season label
    svg.append("text").attr("x",m.left-8).attr("y",yOff+rowH/2+4)
      .attr("text-anchor","end").attr("fill","#555").attr("font-size","10px").attr("font-weight","600")
      .text(`Season ${sn}`);

    scores.forEach((d,i)=>{
      const col=colorScale(d.score);
      const identity=d.score>.65?"Lawyer":d.score<.35?"Vigilante":"Conflict";
      svg.append("rect").attr("class","id-block")
        .attr("x",m.left+i*bW).attr("y",yOff).attr("width",bW-1).attr("height",rowH)
        .attr("fill",col).attr("opacity",.85)
        .on("mousemove",ev=>showTT(ev,`<div class="tt-name">${d.ep}</div>
          <div class="tt-row">Mode: <span style="color:${col}">${identity}</span></div>
          <div class="tt-row">Score: <span>${Math.round(d.score*100)}%</span></div>`))
        .on("mouseleave",hideTT);

      // Ep label every 3rd
      if(i%3===0) svg.append("text").attr("x",m.left+i*bW+bW/2).attr("y",yOff+rowH+12)
        .attr("text-anchor","middle").attr("fill","#3a3a3a").attr("font-size","7px")
        .text(d.ep.replace("S0","S").replace("E0","E"));
    });

    avgScores[sn]=d3.mean(scores,d=>d.score);
  });

  // Legend
  const legX=W-180;
  [{l:"Lawyer",c:"#4a9eff"},{l:"Conflict",c:"#9b59b6"},{l:"Vigilante",c:"#ff2a2a"}].forEach((d,i)=>{
    svg.append("rect").attr("x",legX+i*60).attr("y",2).attr("width",10).attr("height",10).attr("fill",d.c).attr("rx",2);
    svg.append("text").attr("x",legX+i*60+14).attr("y",10).attr("fill","#555").attr("font-size","8px").text(d.l);
  });

  // Interpretation label
  const ins=document.getElementById("identity-insight");
  const s1=avgScores[1],s2=avgScores[2],s3=avgScores[3];
  let msg="";
  if(s1!==undefined&&s2!==undefined&&s3!==undefined){
    if(s2<s1&&s3<s2) msg="Matt progressively shifts toward Daredevil across all three seasons.";
    else if(s2<s1) msg="Matt shifts toward Daredevil mode in Season 2, then finds some balance in Season 3.";
    else if(s3<s1) msg="Matt remains largely in lawyer mode through S1–S2, embracing the vigilante more in Season 3.";
    else msg="Matt maintains a complex balance between his dual identities across all seasons.";
  }else if(Object.keys(avgScores).length===1){
    const sn=Object.keys(avgScores)[0],v=avgScores[sn];
    msg=v>.6?`Season ${sn}: Matt leans heavily into his lawyer identity.`:v<.4?`Season ${sn}: The vigilante dominates.`:`Season ${sn}: Matt is torn between identities.`;
  }
  ins.textContent=msg;
}

// THEME TRACKER 
function computeThemes(){
  const eps=getEpsForSeason();
  return eps.map(ep=>{
    let ls=S.lines.filter(d=>d.ep===ep);
    if(S.char!=="all") ls=ls.filter(d=>d.speaker===S.char);
    const tot=ls.reduce((s,d)=>s+d.line.split(/\s+/).length,0)||1;
    const scores={};
    THEMES_FULL.forEach(t=>{let c=0;ls.forEach(d=>{const tk=d.line.toLowerCase().split(/\s+/);THEME_KW[t].forEach(kw=>{c+=tk.filter(x=>x.includes(kw)).length;});});scores[t]=(c/tot)*1000;});
    return{ep,...scores};
  });
}

function renderThemes(){
  const ct=document.getElementById("theme-chart");ct.innerHTML="";
  const btnCt=document.getElementById("theme-btns");btnCt.innerHTML="";

  // Toggle buttons
  const allBtn=document.createElement("button");allBtn.className="theme-btn";allBtn.textContent="All";
  allBtn.style.borderColor="#888";allBtn.style.color="#888";
  allBtn.addEventListener("click",()=>{THEMES_FULL.forEach(t=>S.activeThemes.add(t));renderThemes();});
  btnCt.appendChild(allBtn);

  THEMES_FULL.forEach(t=>{
    const b=document.createElement("button");
    b.className="theme-btn"+(S.activeThemes.has(t)?" active":" inactive");
    b.textContent=t;b.style.borderColor=THEME_COL[t];b.style.color=THEME_COL[t];
    if(S.activeThemes.has(t)) b.style.background=THEME_COL[t]+"22";
    b.addEventListener("click",()=>{if(S.activeThemes.has(t))S.activeThemes.delete(t);else S.activeThemes.add(t);renderThemes();});
    btnCt.appendChild(b);
  });

  const data=computeThemes();
  const active=THEMES_FULL.filter(t=>S.activeThemes.has(t));
  if(!active.length||!data.length) return;

  const W=ct.clientWidth||500,H=220;
  const m={top:8,right:16,bottom:36,left:36},w=W-m.left-m.right,h=H-m.top-m.bottom;
  const svg=d3.select(ct).append("svg").attr("width",W).attr("height",H);
  const g=svg.append("g").attr("transform",`translate(${m.left},${m.top})`);

  const eps=data.map(d=>d.ep);
  const x=d3.scalePoint().domain(eps).range([0,w]);
  const maxY=d3.max(data.flatMap(d=>active.map(t=>d[t])))||1;
  const y=d3.scaleLinear().domain([0,maxY]).nice().range([h,0]);

  // Grid
  g.append("g").call(d3.axisLeft(y).ticks(3).tickSize(-w).tickFormat(""))
    .selectAll("line").attr("stroke","#1a1a1a");g.select("path").remove();

  // Season dividers
  ["S02E01","S03E01"].forEach(ep=>{
    if(!eps.includes(ep))return;
    g.append("line").attr("x1",x(ep)).attr("x2",x(ep)).attr("y1",0).attr("y2",h)
      .attr("stroke","#282828").attr("stroke-dasharray","3,3");
    g.append("text").attr("x",x(ep)+4).attr("y",10).attr("fill","#333").attr("font-size","8px")
      .text(ep.startsWith("S02")?"S2":"S3");
  });

  g.append("g").attr("class","axis").attr("transform",`translate(0,${h})`)
    .call(d3.axisBottom(x).tickValues(eps.filter((_,i)=>i===0)).tickFormat(d=>"S"+d[2]));
  g.append("g").attr("class","axis").call(d3.axisLeft(y).ticks(3));

  THEMES_FULL.forEach(t=>{
    const isActive=S.activeThemes.has(t);
    const ln=d3.line().x(d=>x(d.ep)).y(d=>y(d[t])).curve(d3.curveMonotoneX);
    g.append("path").datum(data).attr("class","theme-line")
      .attr("stroke",THEME_COL[t]).attr("d",ln)
      .attr("opacity",isActive?1:.12);

    if(isActive){
      g.append("path").datum(data).attr("fill","none").attr("stroke","transparent").attr("stroke-width",10).attr("d",ln)
        .on("mousemove",ev=>showTT(ev,`<div class="tt-name" style="color:${THEME_COL[t]}">${t}</div>`))
        .on("mouseleave",hideTT);
    }
  });
}

// EMOTION TIMELINE 
function renderEmotion(){
  const ct=document.getElementById("emotion-timeline");ct.innerHTML="";
  const scenes=fScenes();if(!scenes.length)return;
  const seasons=S.season==="all" ? [1,2,3] : [+S.season];
  const scenesBySeason=seasons.map(sn=>({
    season:sn,
    scenes:scenes.filter(sc=>sc.season===sn),
  })).filter(d=>d.scenes.length);
  if(!scenesBySeason.length) return;

  const W=ct.clientWidth||500;
  const m={top:16,right:12,bottom:20,left:52},w=W-m.left-m.right;
  const stripH=42,rowGap=30,tickGap=18;
  const legendRows=Math.ceil(Object.keys(EMO_COL).length/4);
  const legendH=legendRows*16;
  const rowBlockH=stripH+tickGap+rowGap;
  const rowsH=scenesBySeason.length*rowBlockH-rowGap;
  const H=m.top+rowsH+32+legendH+m.bottom;
  const svg=d3.select(ct).append("svg").attr("width",W).attr("height",H);
  const g=svg.append("g").attr("transform",`translate(${m.left},${m.top})`);

  scenesBySeason.forEach((row,ri)=>{
    const rowY=ri*rowBlockH;
    const rowScenes=row.scenes;
    const cellW=Math.max(2.5,w/rowScenes.length);

    g.append("text").attr("x",-8).attr("y",rowY+stripH/2+3)
      .attr("text-anchor","end").attr("fill","#555").attr("font-size","9px").attr("font-weight","600")
      .text(`S${row.season}`);

    rowScenes.forEach((sc,i)=>{
      const col=EMO_COL[sc.emo]||"#333";
      g.append("rect").attr("class","emo-strip").attr("x",i*cellW).attr("y",rowY)
        .attr("width",cellW).attr("height",stripH).attr("fill",col).attr("opacity",.75)
        .attr("stroke","#111").attr("stroke-width",Math.min(0.4,cellW*0.15))
        .on("mousemove",ev=>showTT(ev,`<div class="tt-name">${sc.ep}</div>
          <div class="tt-row">Scene: <span>${sc.sid.split("_").pop()}</span></div>
          <div class="tt-row">Emotion: <span style="color:${col}">${sc.emo}</span></div>
          <div class="tt-row">Location: <span>${sc.loc}</span></div>`))
        .on("mouseleave",hideTT);
    });

    let last="";
    rowScenes.forEach((sc,i)=>{
      if(sc.ep!==last){
        g.append("line").attr("x1",i*cellW).attr("x2",i*cellW).attr("y1",rowY+stripH).attr("y2",rowY+stripH+6).attr("stroke","#333");
        if(i%4===0) g.append("text").attr("x",i*cellW).attr("y",rowY+stripH+16).attr("fill","#3a3a3a").attr("font-size","7px")
          .attr("transform",`rotate(-25,${i*cellW},${rowY+stripH+16})`).text(sc.ep);
        last=sc.ep;
      }
    });
  });

  // Legend
  const emos=Object.keys(EMO_COL);
  const lg=svg.append("g").attr("transform",`translate(${m.left},${m.top+rowsH+32})`);
  emos.forEach((em,i)=>{
    const lx=(i%4)*(w/4),ly=Math.floor(i/4)*16;
    lg.append("rect").attr("x",lx).attr("y",ly).attr("width",8).attr("height",8).attr("fill",EMO_COL[em]).attr("rx",2);
    lg.append("text").attr("x",lx+12).attr("y",ly+7).attr("fill","#444").attr("font-size","8px").text(em);
  });
}


const LOCS=[ // Would have loved to have more locations and not hardcode it but I had to hardcode a lot of it
  {name:"Nelson & Murdock Office",lat:40.7614,lng:-74.0023,desc:"The law office at the heart of Hell's Kitchen",kw:["kitchen","nelson","murdock","office"],color:"#ff2a2a",icon:"⚖️"},
  {name:"Sacred Saints Church",lat:40.759,lng:-73.997,desc:"Matt's confessional sanctuary",kw:["church","confessional","chapel","lantom"],color:"#f39c12",icon:"✝️"},
  {name:"The Docks",lat:40.7282,lng:-74.017,desc:"Criminal trafficking operations",kw:["dock","pier","warehouse","shipping"],color:"#8b0000",icon:"⚓"},
  {name:"Claire's Apartment",lat:40.764,lng:-74.004,desc:"Matt's field hospital",kw:["claire","apartment","nurse","stitch"],color:"#16a085",icon:"🏥"},
  {name:"Fisk's Penthouse",lat:40.768,lng:-73.985,desc:"Wilson Fisk's domain of power",kw:["penthouse","fisk","executive","vanessa"],color:"#8e44ad",icon:"🏙️"},
  {name:"Josie's Bar",lat:40.762,lng:-74.0,desc:"Foggy and Karen's watering hole",kw:["josie","bar","drink","beer"],color:"#4a9eff",icon:"🍺"},
  {name:"NY Bulletin",lat:40.7548,lng:-73.9998,desc:"Ben Urich's newspaper",kw:["bulletin","newspaper","journalist","ellison"],color:"#27ae60",icon:"📰"},
  {name:"The Streets",lat:40.756,lng:-74.006,desc:"Where Daredevil patrols",kw:["street","alley","rooftop","patrol"],color:"#c0392b",icon:"🌃"},
];

let leafMap=null;
function renderMap(){
  if(leafMap){leafMap.remove();leafMap=null;}
  leafMap=L.map("leaflet-map",{center:[40.762,-74],zoom:14,zoomControl:true});
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"&copy; OSM",maxZoom:19}).addTo(leafMap);

  const legList=document.getElementById("map-legend-list");legList.innerHTML="";

  LOCS.forEach(loc=>{
    const cnt=S.scenes.filter(s=>{const t=(s.loc+" "+s.text).toLowerCase();return loc.kw.some(k=>t.includes(k));}).length;
    const emoScenes=S.scenes.filter(s=>{const t=(s.loc+" "+s.text).toLowerCase();return loc.kw.some(k=>t.includes(k));});
    const emo=emoScenes.length?[...d3.rollup(emoScenes,v=>v.length,d=>d.emo).entries()].sort((a,b)=>b[1]-a[1])[0][0]:"unknown";
    const ec=EMO_COL[emo]||"#333";

    const icon=L.divIcon({
      html:`<div style="width:28px;height:28px;background:${loc.color};border:2px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 0 8px ${loc.color}66"><span style="transform:rotate(45deg);font-size:12px">${loc.icon}</span></div>`,
      iconSize:[28,28],iconAnchor:[14,28],className:""
    });

    const mk=L.marker([loc.lat,loc.lng],{icon}).addTo(leafMap);
    mk.bindPopup(`<div class="pop-title">${loc.icon} ${loc.name}</div><div class="pop-row">${loc.desc}</div><hr style="border-color:#222;margin:.4rem 0"/><div class="pop-row">Scenes: <span>${cnt}</span></div><div class="pop-row">Emotion: <span style="color:${ec}">${emo}</span></div>`);
    mk.on("click",()=>{
      document.getElementById("map-selected-info").innerHTML=`<div class="loc-name">${loc.icon} ${loc.name}</div><div class="loc-stat">Scenes: <strong>${cnt}</strong></div><div class="loc-stat">Emotion: <strong style="color:${ec}">${emo}</strong></div><div class="loc-stat" style="color:#444;margin-top:.3rem;font-style:italic">${loc.desc}</div>`;
    });

    const item=document.createElement("div");item.className="map-leg-item";
    item.innerHTML=`<div class="map-leg-dot" style="background:${loc.color}"></div><span>${loc.name}</span>`;
    legList.appendChild(item);
  });
}


function setupFade(){
  const obs=new IntersectionObserver(entries=>{
    entries.forEach(e=>{if(e.isIntersecting)e.target.classList.add("visible");});
  },{threshold:.06});
  document.querySelectorAll(".fade-section").forEach(s=>obs.observe(s));
}

function clamp(v,lo,hi){return Math.max(lo,Math.min(hi,v));}

let resizeT;
window.addEventListener("resize",()=>{
  clearTimeout(resizeT);
  resizeT=setTimeout(()=>{
    S.netInitialized=false;S.netFull=null;
    d3.select("#network-svg").selectAll("*").remove();
    renderAll();renderMap();
  },400);
});

setTimeout(()=>{if(S.lines.length)renderMap();},200); // This is for the NYC map 
