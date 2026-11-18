(function(root){
// ---------- DATA: fictional 3-floor hospital ----------
const H=8,XS=[-12,-4,4,12],FN=["Ground floor","Floor 1","Floor 2"];
const NM=[[["Reception","Emergency","Pharmacy","Cafeteria"],["Restroom","Main Entrance","Radiology","Laboratory"]],
[["Cardiology","Pediatrics","Orthopedics","Dermatology"],["Outpatient Clinic","ENT","Eye Clinic","Restroom"]],
[["ICU","Surgery","Maternity","Neurology"],["Ward A","Ward B","Ward C","Chapel"]]];
const COL={Emergency:0xe5484d,Restroom:0x8b99ad,Pharmacy:0x30a46c,"Main Entrance":0xf5a524,Chapel:0xa78bfa};
const pos={},adj={},L={},fl={},rooms=[];
function nd(id,f,x,z,name){pos[id]=[x,f*H,z];adj[id]=[];fl[id]=f;if(name)L[id]=name}
function ad(a,b,k,w){if(w==null){const p=pos[a],q=pos[b];w=Math.hypot(p[0]-q[0],p[2]-q[2])/1.2}adj[a].push([b,w,k]);adj[b].push([a,w,k])}
for(let f=0;f<3;f++){
 nd("e"+f,f,-18,0,"elevator");nd("s"+f,f,18,0,"stairs");
 XS.forEach((x,c)=>{nd("c"+f+c,f,x,0)});
 ad("e"+f,"c"+f+0,"h");ad("s"+f,"c"+f+3,"h");for(let c=0;c<3;c++)ad("c"+f+c,"c"+f+(c+1),"h");
 for(let s=0;s<2;s++)for(let c=0;c<4;c++){const id="r"+f+s+c;nd(id,f,XS[c],s?5:-5,NM[f][s][c]);ad("c"+f+c,id,"h");rooms.push(id)}
 if(f){ad("e"+(f-1),"e"+f,"e",30);ad("s"+(f-1),"s"+f,"s",12)}
}
const byName=n=>rooms.find(r=>L[r]==n);
// ---------- ROUTING ----------
function dj(src,sf,cl){cl=cl||new Set();const D={},P={},Q=new Set(Object.keys(pos));Q.forEach(k=>D[k]=1e9);D[src]=0;
 while(Q.size){let u=null;for(const k of Q)if(u==null||D[k]<D[u])u=k;Q.delete(u);if(D[u]>=1e9)break;
  for(const[v,w,k]of adj[u]){if(sf&&k=="s"||cl.has(u+"|"+v))continue;if(D[u]+w<D[v]){D[v]=D[u]+w;P[v]=u}}}return{D,P}}
function path(a,b,sf,cl){const{D,P}=dj(a,sf,cl),p=[b];while(p[0]!=a&&P[p[0]])p.unshift(P[p[0]]);return{p,t:D[b]}}
const hd=(a,b)=>Math.hypot(pos[a][0]-pos[b][0],pos[a][2]-pos[b][2]);
function directions(p){const o=[{t:"start",n:L[p[0]],f:fl[p[0]]}];let d=0,i=0;
 while(i<p.length-1){const a=p[i],b=p[i+1];
  if(fl[a]!=fl[b]){const k=a[0]=="e"?"elevator":"stairs";if(d>1){o.push({t:"walk",m:Math.round(d),k});d=0}
   let j=i+1;while(j<p.length-1&&fl[p[j]]!=fl[p[j+1]])j++;
   o.push({t:"take",k,f:fl[p[j]]});i=j}
  else{d+=hd(a,b);i++}}
 o.push({t:"end",m:Math.round(d),n:L[p[p.length-1]]});return o}
const I18={en:{f:FN,k:{elevator:"elevator",stairs:"stairs"},start:"Start at {n} ({f}).",walk:"Walk about {m} m to the {k}.",take:"Take the {k} to {f}.",end:"Walk about {m} m to {n}. You have arrived."},
es:{f:["Planta baja","Piso 1","Piso 2"],k:{elevator:"el ascensor",stairs:"las escaleras"},start:"Comience en {n} ({f}).",walk:"Camine unos {m} m hasta {k}.",take:"Tome {k} hasta {f}.",end:"Camine unos {m} m hasta {n}. Ha llegado."},
hi:{f:["भूतल","पहली मंज़िल","दूसरी मंज़िल"],k:{elevator:"लिफ्ट",stairs:"सीढ़ियाँ"},start:"{n} से शुरू करें ({f})।",walk:"{k} तक लगभग {m} मीटर चलें।",take:"{k} से {f} पर जाएँ।",end:"{n} तक लगभग {m} मीटर चलें। आप पहुँच गए।"}};
function fmt(s,lg){const c=I18[lg]||I18.en;return c[s.t].replace("{n}",s.n).replace("{f}",c.f[s.f]).replace("{m}",s.m).replace("{k}",c.k[s.k])}

const api={H,XS,FN,NM,COL,pos,adj,L,fl,rooms,byName,dj,path,hd,directions,fmt,I18};
if(typeof module!=='undefined')module.exports=api;else root.Hospital=api;
})(this);
