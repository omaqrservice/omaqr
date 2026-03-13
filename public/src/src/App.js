import { useState, useRef, useEffect, useCallback } from “react”;

/* ══════════════════════════════════════════════
PALETTES & TEMPLATES
══════════════════════════════════════════════ */
const QR_PALETTES = [
{ name:“Cyan Néon”,   fg:”#00FFFF”, bg:”#050d1a” },
{ name:“Or Luxe”,     fg:”#FFD700”, bg:”#0a0a0f” },
{ name:“Violet”,      fg:”#c47eff”, bg:”#0f0a1e” },
{ name:“Rose”,        fg:”#ff6eb4”, bg:”#0f0008” },
{ name:“Vert Matrix”, fg:”#39ff14”, bg:”#020d02” },
{ name:“Blanc”,       fg:”#ffffff”, bg:”#111”    },
{ name:“Orange”,      fg:”#ff8800”, bg:”#0f0600” },
{ name:“Rouge”,       fg:”#ff2244”, bg:”#0f0005” },
{ name:“Bleu Royal”,  fg:”#4488ff”, bg:”#02050f” },
{ name:“Turquoise”,   fg:”#00ffcc”, bg:”#021a14” },
{ name:“Doré Rose”,   fg:”#ffb347”, bg:”#0f0808” },
{ name:“Argent”,      fg:”#c0c0c0”, bg:”#0a0a0a” },
];

const TEMPLATES = {
luxe:    { name:“✦ Luxe”,    accent:”#FFD700”, bg:“linear-gradient(155deg,#0a0a0f,#14100a)”, btnBg:“rgba(255,215,0,0.08)”,   border:“rgba(255,215,0,0.25)”,   sectionBg:“rgba(255,215,0,0.04)”   },
pro:     { name:“⬡ Pro”,     accent:”#00FFFF”, bg:“linear-gradient(155deg,#050d1a,#0a1628)”, btnBg:“rgba(0,255,255,0.08)”,   border:“rgba(0,255,255,0.22)”,   sectionBg:“rgba(0,255,255,0.03)”   },
creator: { name:“◈ Creator”, accent:”#c47eff”, bg:“linear-gradient(155deg,#0f0a1e,#160d2a)”, btnBg:“rgba(180,100,255,0.08)”, border:“rgba(180,100,255,0.25)”, sectionBg:“rgba(180,100,255,0.04)” },
minimal: { name:“○ Minimal”, accent:”#ffffff”, bg:“linear-gradient(155deg,#0d0d0d,#141414)”, btnBg:“rgba(255,255,255,0.05)”, border:“rgba(255,255,255,0.12)”, sectionBg:“rgba(255,255,255,0.02)” },
rose:    { name:“✿ Rose”,    accent:”#ff6eb4”, bg:“linear-gradient(155deg,#140a10,#1e0d16)”, btnBg:“rgba(255,110,180,0.08)”, border:“rgba(255,110,180,0.25)”, sectionBg:“rgba(255,110,180,0.04)” },
};

/* ══════════════════════════════════════════════
MOCK USERS
══════════════════════════════════════════════ */
const INIT_USERS = [
{ id:1, name:“Angela K.”, email:“angela@nail.com”, plan:“Pro”, status:“active”, joined:“2025-01-10”, scans:142,
profile:{ name:“Angela K.”, bio:“Nail Tech & Formatrice 💅 Congo · Kinshasa”, avatar:null, template:“rose”, qrIdx:3,
links:[{id:1,platform:“Instagram”,label:“Mon Instagram”,url:“https://instagram.com/”},{id:2,platform:“WhatsApp”,label:“Réserver”,url:“https://wa.me/”}],
files:[{id:1,label:“Catalogue Nail Art 2025”,url:“https://dropbox.com/s/abc”,tag:“PDF”}],
sections:[{id:1,title:“À propos”,content:“Formatrice certifiée en nail art · 5 ans d’expérience”,visible:true}]}},
{ id:2, name:“Abc Studio”, email:“abc@studio.com”, plan:“Luxe”, status:“active”, joined:“2025-02-03”, scans:89,
profile:{ name:“Abc Studio”, bio:“Studio Beauté Premium 🌹 Rose · Blanc · Or”, avatar:null, template:“luxe”, qrIdx:1,
links:[{id:1,platform:“Instagram”,label:“Instagram”,url:“https://instagram.com/”}],
files:[{id:1,label:“Tarifs & Soins”,url:“https://dropbox.com/s/def”,tag:“PDF”}],
sections:[{id:1,title:“Nos Services”,content:“Soins visage · Manucure · Maquillage”,visible:true}]}},
{ id:3, name:“Alvine M.”, email:“alvine@mail.com”, plan:“Free”, status:“blocked”, joined:“2025-03-01”, scans:12,
profile:{ name:“Alvine M.”, bio:“Créatrice de contenu 🎬”, avatar:null, template:“creator”, qrIdx:2, links:[], files:[], sections:[] }},
];

/* ══════════════════════════════════════════════
QR CANVAS GENERATOR
══════════════════════════════════════════════ */
function QRCanvas({ text, fg, bg, size=150 }) {
const ref = useRef();
useEffect(() => {
const c = ref.current; if (!c) return;
const ctx = c.getContext(“2d”);
const N=25; c.width=size; c.height=size;
ctx.fillStyle=bg; ctx.fillRect(0,0,size,size);
const cell=size/N;
let seed=0;
for(let i=0;i<text.length;i++) seed=(seed*31+text.charCodeAt(i))&0xffffffff;
const rng=()=>{ seed^=seed<<13; seed^=seed>>17; seed^=seed<<5; return (seed>>>0)/0xffffffff; };
const grid=Array.from({length:N},()=>Array.from({length:N},()=>rng()>0.45));
[[0,0],[0,N-7],[N-7,0]].forEach(([r,cc])=>{
for(let i=0;i<7;i++) for(let j=0;j<7;j++)
grid[r+i][cc+j]=i===0||i===6||j===0||j===6||(i>=2&&i<=4&&j>=2&&j<=4);
});
ctx.shadowColor=fg; ctx.shadowBlur=5; ctx.fillStyle=fg;
for(let r=0;r<N;r++) for(let cc=0;cc<N;cc++){
if(grid[r][cc]){ ctx.beginPath(); ctx.roundRect(cc*cell+1,r*cell+1,cell-2,cell-2,2); ctx.fill(); }
}
},[text,fg,bg,size]);
return <canvas ref={ref} style={{width:size,height:size,borderRadius:10,display:“block”}}/>;
}

/* ══════════════════════════════════════════════
QR SCANNER (caméra)
══════════════════════════════════════════════ */
function QRScanner({ onClose }) {
const videoRef  = useRef();
const canvasRef = useRef();
const streamRef = useRef();
const [status,  setStatus]  = useState(“starting”); // starting | scanning | result | error
const [result,  setResult]  = useState(null);
const [error,   setError]   = useState(””);
const intervalRef = useRef();

useEffect(() => {
startCamera();
return () => stopCamera();
}, []);

const startCamera = async () => {
try {
const stream = await navigator.mediaDevices.getUserMedia({
video: { facingMode: “environment”, width:{ideal:1280}, height:{ideal:720} }
});
streamRef.current = stream;
if (videoRef.current) {
videoRef.current.srcObject = stream;
videoRef.current.play();
setStatus(“scanning”);
// Scan loop every 400ms
intervalRef.current = setInterval(scanFrame, 400);
}
} catch(e) {
setError(“Impossible d’accéder à la caméra. Autorise l’accès dans ton navigateur.”);
setStatus(“error”);
}
};

const stopCamera = () => {
clearInterval(intervalRef.current);
if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
};

const scanFrame = () => {
const video  = videoRef.current;
const canvas = canvasRef.current;
if (!video || !canvas || video.readyState < 2) return;
const ctx = canvas.getContext(“2d”);
canvas.width  = video.videoWidth;
canvas.height = video.videoHeight;
ctx.drawImage(video, 0, 0);
try {
// Use BarcodeDetector if available (Chrome/Android)
if (“BarcodeDetector” in window) {
const detector = new window.BarcodeDetector({ formats: [“qr_code”] });
detector.detect(canvas).then(codes => {
if (codes.length > 0) {
clearInterval(intervalRef.current);
stopCamera();
setResult(codes[0].rawValue);
setStatus(“result”);
}
});
} else {
// Fallback: simulate detection for demo
setStatus(“scanning”);
}
} catch(e) {}
};

const openResult = () => {
if (result) {
const url = result.startsWith(“http”) ? result : `https://${result}`;
window.open(url, “_blank”);
}
};

const reset = () => {
setResult(null);
setStatus(“starting”);
startCamera();
};

return (
<div style={{
position:“fixed”, inset:0, zIndex:1000,
background:“rgba(0,0,0,0.95)”, backdropFilter:“blur(10px)”,
display:“flex”, flexDirection:“column”, alignItems:“center”, justifyContent:“center”,
}}>
{/* Header */}
<div style={{ position:“absolute”, top:0, left:0, right:0, padding:“20px 24px”,
display:“flex”, alignItems:“center”, justifyContent:“space-between” }}>
<div style={{ display:“flex”, alignItems:“center”, gap:10 }}>
<span style={{ fontSize:20 }}>📷</span>
<span style={{ fontSize:16, fontWeight:800, color:”#fff”, letterSpacing:.5 }}>
OMA <span style={{ color:”#00FFFF” }}>Scanner</span>
</span>
</div>
<button onClick={()=>{ stopCamera(); onClose(); }} style={{
background:“rgba(255,255,255,0.08)”, border:“1px solid rgba(255,255,255,0.15)”,
borderRadius:10, color:”#fff”, padding:“8px 16px”, cursor:“pointer”, fontSize:13
}}>✕ Fermer</button>
</div>

```
  {/* Camera view */}
  {(status==="starting"||status==="scanning") && (
    <div style={{ position:"relative", width:320, height:320 }}>
      <video ref={videoRef} style={{
        width:"100%", height:"100%", objectFit:"cover",
        borderRadius:24, display:"block",
      }} playsInline muted/>
      <canvas ref={canvasRef} style={{ display:"none" }}/>

      {/* Scanning overlay */}
      <div style={{ position:"absolute", inset:0, borderRadius:24,
        border:"2px solid rgba(0,255,255,0.4)",
        boxShadow:"inset 0 0 40px rgba(0,255,255,0.1)" }}/>

      {/* Corner brackets */}
      {[{top:10,left:10},{top:10,right:10},{bottom:10,left:10},{bottom:10,right:10}].map((pos,i)=>(
        <div key={i} style={{ position:"absolute", width:28, height:28, ...pos,
          borderColor:"#00FFFF", borderStyle:"solid", borderWidth:0,
          ...(pos.top!==undefined&&pos.left!==undefined  ? {borderTopWidth:3,borderLeftWidth:3,borderTopLeftRadius:8}:{}),
          ...(pos.top!==undefined&&pos.right!==undefined ? {borderTopWidth:3,borderRightWidth:3,borderTopRightRadius:8}:{}),
          ...(pos.bottom!==undefined&&pos.left!==undefined  ? {borderBottomWidth:3,borderLeftWidth:3,borderBottomLeftRadius:8}:{}),
          ...(pos.bottom!==undefined&&pos.right!==undefined ? {borderBottomWidth:3,borderRightWidth:3,borderBottomRightRadius:8}:{}),
        }}/>
      ))}

      {/* Scan line animation */}
      <div style={{
        position:"absolute", left:10, right:10, height:2,
        background:"linear-gradient(90deg,transparent,#00FFFF,transparent)",
        boxShadow:"0 0 8px #00FFFF",
        animation:"scanline 2s linear infinite",
        top:"50%",
      }}/>
    </div>
  )}

  {/* Status text */}
  <div style={{ marginTop:24, textAlign:"center" }}>
    {status==="starting" && <div style={{ color:"#666", fontSize:14 }}>Démarrage de la caméra...</div>}
    {status==="scanning" && (
      <>
        <div style={{ color:"#00FFFF", fontSize:15, fontWeight:600, marginBottom:6 }}>
          📡 Scanning en cours...
        </div>
        <div style={{ color:"#555", fontSize:12 }}>
          Place ton QR code dans le cadre
        </div>
      </>
    )}
  </div>

  {/* Result */}
  {status==="result" && (
    <div style={{ textAlign:"center", padding:"0 30px", maxWidth:380 }}>
      <div style={{ fontSize:48, marginBottom:16 }}>✅</div>
      <div style={{ color:"#39ff14", fontSize:16, fontWeight:700, marginBottom:8 }}>
        QR Code détecté !
      </div>
      <div style={{
        background:"rgba(0,255,255,0.08)", border:"1px solid rgba(0,255,255,0.2)",
        borderRadius:12, padding:"12px 16px", marginBottom:20,
        fontSize:13, color:"#ccc", wordBreak:"break-all", lineHeight:1.5,
      }}>
        {result}
      </div>
      <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap" }}>
        <button onClick={openResult} style={{
          padding:"12px 24px", borderRadius:12, cursor:"pointer", fontWeight:700, fontSize:14,
          background:"rgba(0,255,255,0.1)", border:"1px solid #00FFFF", color:"#00FFFF",
          boxShadow:"0 0 16px rgba(0,255,255,0.3)",
        }}>🔗 Ouvrir le lien</button>
        <button onClick={reset} style={{
          padding:"12px 24px", borderRadius:12, cursor:"pointer", fontWeight:700, fontSize:14,
          background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.15)", color:"#888",
        }}>↩ Scanner encore</button>
      </div>
    </div>
  )}

  {/* Error */}
  {status==="error" && (
    <div style={{ textAlign:"center", padding:"0 30px", maxWidth:360 }}>
      <div style={{ fontSize:48, marginBottom:16 }}>⚠️</div>
      <div style={{ color:"#ff4455", fontSize:15, fontWeight:600, marginBottom:10 }}>Caméra inaccessible</div>
      <div style={{ color:"#666", fontSize:13, marginBottom:20, lineHeight:1.6 }}>{error}</div>
      <div style={{ background:"rgba(0,255,255,0.06)", border:"1px solid rgba(0,255,255,0.2)",
        borderRadius:12, padding:"14px 16px", fontSize:12, color:"#aaa", lineHeight:1.7, textAlign:"left" }}>
        <strong style={{ color:"#00FFFF" }}>Comment activer :</strong><br/>
        • Chrome : Paramètres → Confidentialité → Caméra<br/>
        • Safari : Réglages → Safari → Caméra → Autoriser<br/>
        • Firefox : clic sur le 🔒 dans la barre d'adresse
      </div>
    </div>
  )}

  {/* Demo note if no BarcodeDetector */}
  {status==="scanning" && !("BarcodeDetector" in window) && (
    <div style={{ marginTop:16, background:"rgba(255,215,0,0.08)", border:"1px solid rgba(255,215,0,0.2)",
      borderRadius:10, padding:"10px 16px", fontSize:12, color:"#FFD700", maxWidth:300, textAlign:"center" }}>
      ⚠️ Ton navigateur ne supporte pas la détection auto.<br/>
      <strong>Chrome sur Android/Desktop</strong> est recommandé.
    </div>
  )}

  <style>{`
    @keyframes scanline {
      0%   { top: 10%; }
      50%  { top: 85%; }
      100% { top: 10%; }
    }
  `}</style>
</div>
```

);
}

/* ══════════════════════════════════════════════
PHONE PREVIEW
══════════════════════════════════════════════ */
function PhonePreview({ T, profile }) {
const { name, bio, avatar, links=[], files=[], sections=[], qrIdx=0 } = profile;
const qrP = QR_PALETTES[qrIdx] || QR_PALETTES[0];
const slug = (name||“user”).toLowerCase().replace(/\s+/g,”-”);

const ICON_MAP = { WhatsApp:IC_WA, Instagram:IC_IG, TikTok:IC_TT, YouTube:IC_YT, Facebook:IC_FB };

return (
<div style={{ width:260, flexShrink:0,
background:”#1c1c1e”, borderRadius:44, padding:“10px”,
boxShadow:`0 40px 80px rgba(0,0,0,0.9),inset 0 0 0 2px #2a2a2a,0 0 50px ${T.accent}22`,
border:“2px solid #2c2c2e” }}>
<div style={{ width:80,height:22,background:”#1c1c1e”,borderRadius:11,margin:“0 auto 6px”,border:“2px solid #2a2a2a” }}/>
<div style={{ borderRadius:34,overflow:“hidden”,height:500,overflowY:“auto”,background:T.bg,scrollbarWidth:“none” }}>
<div style={{ padding:“22px 14px 28px” }}>
<div style={{ textAlign:“center”, marginBottom:18 }}>
<div style={{ width:72,height:72,borderRadius:“50%”,border:`3px solid ${T.accent}`,
margin:“0 auto 10px”,overflow:“hidden”,background:T.btnBg,
display:“flex”,alignItems:“center”,justifyContent:“center”,
boxShadow:`0 0 20px ${T.accent}44`,fontSize:28 }}>
{avatar ? <img src={avatar} style={{ width:“100%”,height:“100%”,objectFit:“cover” }}/> : “👤”}
</div>
<div style={{ fontSize:16,fontWeight:800,color:T.accent,textShadow:`0 0 16px ${T.accent}55` }}>{name||“Ton Nom”}</div>
<div style={{ fontSize:11,color:“rgba(255,255,255,0.5)”,marginTop:5,lineHeight:1.5,padding:“0 6px” }}>{bio}</div>
</div>
<div style={{ height:1,background:`linear-gradient(90deg,transparent,${T.accent}44,transparent)`,marginBottom:14 }}/>
{sections.filter(s=>s.visible).map(s=>(
<div key={s.id} style={{ marginBottom:10,background:T.sectionBg,border:`1px solid ${T.border}`,borderRadius:10,padding:“10px 12px” }}>
<div style={{ fontSize:9,color:T.accent,letterSpacing:2,textTransform:“uppercase”,marginBottom:4 }}>{s.title}</div>
<div style={{ fontSize:10,color:“rgba(255,255,255,0.6)”,lineHeight:1.5 }}>{s.content}</div>
</div>
))}
{links.map(l=>(
<a key={l.id} href={l.url} target=”_blank” rel=“noreferrer”
style={{ display:“flex”,alignItems:“center”,gap:8,padding:“10px 12px”,
borderRadius:10,background:T.btnBg,border:`1px solid ${T.border}`,
color:T.accent,textDecoration:“none”,fontSize:12,fontWeight:600,marginBottom:7 }}>
<span style={{ opacity:.8 }}>{ICON_MAP[l.platform]||“🔗”}</span>
<span>{l.label}</span>
<span style={{ marginLeft:“auto”,opacity:.35,fontSize:10 }}>↗</span>
</a>
))}
{files.length>0 && (
<>
<div style={{ fontSize:9,color:T.accent,letterSpacing:2,textTransform:“uppercase”,textAlign:“center”,margin:“12px 0 8px” }}>⬡ Ressources</div>
{files.map(f=>(
<a key={f.id} href={f.url} target=”_blank” rel=“noreferrer”
style={{ display:“flex”,alignItems:“center”,gap:8,padding:“10px 12px”,
borderRadius:10,background:T.btnBg,border:`1px solid ${T.border}`,
color:T.accent,textDecoration:“none”,fontSize:12,fontWeight:600,marginBottom:7 }}>
⬇ <span style={{ flex:1 }}>{f.label}</span>
<span style={{ fontSize:9,background:`${T.accent}22`,padding:“2px 6px”,borderRadius:4 }}>{f.tag}</span>
</a>
))}
</>
)}
<div style={{ textAlign:“center”,fontSize:8,color:”#333”,marginTop:18 }}>
Powered by <span style={{ color:T.accent }}>OMA QR</span> · Signé Oma Mhd
</div>
</div>
</div>
<div style={{ width:90,height:4,background:”#2a2a2a”,borderRadius:2,margin:“8px auto 0” }}/>
</div>
);
}

// Mini icons inline
const IC_WA = <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>;
const IC_IG = <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>;
const IC_TT = <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>;
const IC_YT = <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>;
const IC_FB = <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>;

/* ══════════════════════════════════════════════
MAIN APP
══════════════════════════════════════════════ */
export default function OmaQR() {
const [screen,   setScreen]   = useState(“landing”);   // landing | login | register | admin | client
const [users,    setUsers]    = useState(INIT_USERS);
const [authUser, setAuthUser] = useState(null);
const [showScan, setShowScan] = useState(false);

// Landing → Login/Register
// Admin → gère tout
// Client → gère son profil

const login = (email, password, asAdmin=false) => {
if (asAdmin && email===“admin@omaqr.io” && password===“admin123”) {
setAuthUser({ role:“admin”, name:“Oma MHD” });
setScreen(“admin”);
return true;
}
const u = users.find(x=>x.email===email);
if (u) {
if (u.status===“blocked”) return “blocked”;
setAuthUser({ …u, role:“client” });
setScreen(“client”);
return true;
}
return false;
};

const register = (name, email) => {
const newUser = {
id: Date.now(), name, email, plan:“Free”, status:“active”,
joined: new Date().toISOString().split(“T”)[0], scans:0,
profile:{ name, bio:””, avatar:null, template:“pro”, qrIdx:0, links:[], files:[], sections:[] }
};
setUsers(u=>[…u,newUser]);
setAuthUser({ …newUser, role:“client” });
setScreen(“client”);
};

return (
<div style={{ minHeight:“100vh”, background:”#07070a”, color:”#fff”,
fontFamily:”‘SF Pro Display’,-apple-system,sans-serif” }}>
{showScan && <QRScanner onClose={()=>setShowScan(false)}/>}

```
  {screen==="landing"  && <Landing  setScreen={setScreen} setShowScan={setShowScan}/>}
  {screen==="login"    && <Login    setScreen={setScreen} login={login} setShowScan={setShowScan}/>}
  {screen==="register" && <Register setScreen={setScreen} register={register}/>}
  {screen==="admin"    && <AdminDash users={users} setUsers={setUsers} authUser={authUser} setScreen={setScreen} setShowScan={setShowScan}/>}
  {screen==="client"   && <ClientDash authUser={authUser} users={users} setUsers={setUsers} setScreen={setScreen} setShowScan={setShowScan}/>}
</div>
```

);
}

/* ══════════════════════════════════════════════
LANDING PAGE
══════════════════════════════════════════════ */
function Landing({ setScreen, setShowScan }) {
return (
<div style={{ minHeight:“100vh”, display:“flex”, flexDirection:“column”, alignItems:“center”,
justifyContent:“center”, padding:“40px 20px”, textAlign:“center”,
background:“radial-gradient(ellipse at 50% 0%,rgba(0,255,255,0.08) 0%,transparent 60%)” }}>
<div style={{ fontSize:14, letterSpacing:4, color:”#00FFFF”, marginBottom:16, textTransform:“uppercase” }}>
◈ OMA QR
</div>
<h1 style={{ fontSize:“clamp(32px,6vw,56px)”, fontWeight:900, lineHeight:1.1,
margin:“0 0 16px”, letterSpacing:-1 }}>
La carte de visite<br/>
<span style={{ background:“linear-gradient(90deg,#00FFFF,#FFD700)”, WebkitBackgroundClip:“text”,
WebkitTextFillColor:“transparent” }}>du futur</span>
</h1>
<p style={{ fontSize:16, color:“rgba(255,255,255,0.45)”, maxWidth:440, lineHeight:1.7, marginBottom:40 }}>
Crée ta page pro, partage tes fichiers Dropbox, génère ton QR code personnalisé.
Linktree + Carrd + Scanner — tout en un.
</p>
<div style={{ display:“flex”, gap:12, flexWrap:“wrap”, justifyContent:“center”, marginBottom:50 }}>
<button onClick={()=>setScreen(“register”)} style={{
padding:“14px 32px”, borderRadius:14, cursor:“pointer”, fontWeight:800, fontSize:15,
background:“linear-gradient(135deg,#00FFFF22,#FFD70022)”,
border:“1px solid #00FFFF”, color:”#00FFFF”,
boxShadow:“0 0 30px rgba(0,255,255,0.25)”,
}}>Créer mon compte →</button>
<button onClick={()=>setScreen(“login”)} style={{
padding:“14px 32px”, borderRadius:14, cursor:“pointer”, fontWeight:700, fontSize:15,
background:“rgba(255,255,255,0.04)”, border:“1px solid rgba(255,255,255,0.12)”, color:”#888”,
}}>Se connecter</button>
<button onClick={()=>setShowScan(true)} style={{
padding:“14px 24px”, borderRadius:14, cursor:“pointer”, fontWeight:700, fontSize:15,
background:“rgba(255,215,0,0.06)”, border:“1px solid rgba(255,215,0,0.3)”, color:”#FFD700”,
}}>📷 Scanner un QR</button>
</div>
<div style={{ display:“flex”, gap:24, flexWrap:“wrap”, justifyContent:“center” }}>
{[“🔗 Liens sociaux”,“📁 Fichiers Dropbox”,“🎨 QR personnalisé”,“👥 Multi-utilisateurs”,“📷 Scanner intégré”].map(f=>(
<div key={f} style={{ fontSize:13, color:“rgba(255,255,255,0.35)”, padding:“6px 14px”,
background:“rgba(255,255,255,0.04)”, borderRadius:20, border:“1px solid rgba(255,255,255,0.06)” }}>
{f}
</div>
))}
</div>
<div style={{ marginTop:24, fontSize:12, color:”#333” }}>
Admin demo → <span style={{ color:”#555” }}>admin@omaqr.io / admin123</span>
</div>
</div>
);
}

/* ══════════════════════════════════════════════
LOGIN
══════════════════════════════════════════════ */
function Login({ setScreen, login, setShowScan }) {
const [email,setEmail]=useState(””); const [pass,setPass]=useState(””); const [err,setErr]=useState(””);
const inp = { width:“100%”,boxSizing:“border-box”,background:“rgba(255,255,255,0.05)”,
border:“1px solid rgba(0,255,255,0.2)”,borderRadius:10,color:”#fff”,padding:“12px 14px”,fontSize:14,outline:“none” };
const submit = () => {
const r = login(email,pass);
if (r===“blocked”) setErr(“⛔ Ce compte est bloqué. Contacte l’admin.”);
else if (!r) setErr(“Email introuvable. Vérifie ou crée un compte.”);
};
return (
<div style={{ minHeight:“100vh”,display:“flex”,alignItems:“center”,justifyContent:“center”,padding:20 }}>
<div style={{ width:“100%”,maxWidth:380,background:“rgba(0,255,255,0.04)”,
border:“1px solid rgba(0,255,255,0.15)”,borderRadius:20,padding:“32px 28px” }}>
<div style={{ textAlign:“center”,marginBottom:28 }}>
<div style={{ fontSize:22,fontWeight:900,marginBottom:4 }}>OMA <span style={{ color:”#00FFFF” }}>QR</span></div>
<div style={{ fontSize:13,color:”#555” }}>Connexion à ton espace</div>
</div>
<div style={{ display:“flex”,flexDirection:“column”,gap:12 }}>
<input value={email} onChange={e=>setEmail(e.target.value)} placeholder=“Email” type=“email” style={inp}/>
<input value={pass}  onChange={e=>setPass(e.target.value)}  placeholder=“Mot de passe” type=“password” style={inp}/>
{err && <div style={{ fontSize:12,color:”#ff4455”,background:“rgba(255,68,85,0.08)”,padding:“8px 12px”,borderRadius:8 }}>{err}</div>}
<button onClick={submit} style={{ padding:“13px”,borderRadius:12,cursor:“pointer”,fontWeight:800,fontSize:14,
background:“rgba(0,255,255,0.1)”,border:“1px solid #00FFFF”,color:”#00FFFF”,
boxShadow:“0 0 20px rgba(0,255,255,0.2)”,marginTop:4 }}>
Se connecter →
</button>
<button onClick={()=>setShowScan(true)} style={{ padding:“11px”,borderRadius:12,cursor:“pointer”,fontWeight:600,fontSize:13,
background:“rgba(255,215,0,0.06)”,border:“1px solid rgba(255,215,0,0.25)”,color:”#FFD700” }}>
📷 Scanner un QR code
</button>
</div>
<div style={{ textAlign:“center”,marginTop:20,fontSize:12,color:”#555” }}>
Pas encore de compte ?{” “}
<span onClick={()=>setScreen(“register”)} style={{ color:”#00FFFF”,cursor:“pointer” }}>S’inscrire</span>
{” · “}
<span onClick={()=>setScreen(“landing”)} style={{ color:”#555”,cursor:“pointer” }}>Accueil</span>
</div>
</div>
</div>
);
}

/* ══════════════════════════════════════════════
REGISTER
══════════════════════════════════════════════ */
function Register({ setScreen, register }) {
const [name,setName]=useState(””); const [email,setEmail]=useState(””); const [pass,setPass]=useState(””);
const inp = { width:“100%”,boxSizing:“border-box”,background:“rgba(255,255,255,0.05)”,
border:“1px solid rgba(0,255,255,0.2)”,borderRadius:10,color:”#fff”,padding:“12px 14px”,fontSize:14,outline:“none” };
return (
<div style={{ minHeight:“100vh”,display:“flex”,alignItems:“center”,justifyContent:“center”,padding:20 }}>
<div style={{ width:“100%”,maxWidth:380,background:“rgba(0,255,255,0.04)”,
border:“1px solid rgba(0,255,255,0.15)”,borderRadius:20,padding:“32px 28px” }}>
<div style={{ textAlign:“center”,marginBottom:28 }}>
<div style={{ fontSize:22,fontWeight:900,marginBottom:4 }}>OMA <span style={{ color:”#00FFFF” }}>QR</span></div>
<div style={{ fontSize:13,color:”#555” }}>Crée ton compte gratuit</div>
</div>
<div style={{ display:“flex”,flexDirection:“column”,gap:12 }}>
<input value={name}  onChange={e=>setName(e.target.value)}  placeholder=“Ton nom” style={inp}/>
<input value={email} onChange={e=>setEmail(e.target.value)} placeholder=“Email” type=“email” style={inp}/>
<input value={pass}  onChange={e=>setPass(e.target.value)}  placeholder=“Mot de passe” type=“password” style={inp}/>
<button onClick={()=>name&&email&&register(name,email)} style={{ padding:“13px”,borderRadius:12,cursor:“pointer”,fontWeight:800,fontSize:14,
background:“rgba(0,255,255,0.1)”,border:“1px solid #00FFFF”,color:”#00FFFF”,
boxShadow:“0 0 20px rgba(0,255,255,0.2)”,marginTop:4 }}>
Créer mon compte →
</button>
</div>
<div style={{ textAlign:“center”,marginTop:20,fontSize:12,color:”#555” }}>
Déjà inscrit ?{” “}
<span onClick={()=>setScreen(“login”)} style={{ color:”#00FFFF”,cursor:“pointer” }}>Se connecter</span>
</div>
</div>
</div>
);
}

/* ══════════════════════════════════════════════
ADMIN DASHBOARD
══════════════════════════════════════════════ */
function AdminDash({ users, setUsers, authUser, setScreen, setShowScan }) {
const [view, setView] = useState(“list”);   // list | detail
const [selected, setSelected] = useState(null);

const block  = (id) => setUsers(u=>u.map(x=>x.id===id?{…x,status:“blocked”}:x));
const unblock= (id) => setUsers(u=>u.map(x=>x.id===id?{…x,status:“active”}:x));
const remove = (id) => setUsers(u=>u.filter(x=>x.id!==id));

const totalScans = users.reduce((a,u)=>a+u.scans,0);

return (
<div style={{ minHeight:“100vh”,display:“flex”,flexDirection:“column” }}>
{/* Nav */}
<nav style={{ padding:“14px 24px”,borderBottom:“1px solid rgba(255,255,255,0.06)”,
background:“rgba(5,5,10,0.9)”,backdropFilter:“blur(20px)”,
display:“flex”,alignItems:“center”,justifyContent:“space-between”,
position:“sticky”,top:0,zIndex:10 }}>
<div style={{ display:“flex”,alignItems:“center”,gap:10 }}>
<div style={{ width:32,height:32,borderRadius:8,
background:“linear-gradient(135deg,#00FFFF,#FFD700)”,
display:“flex”,alignItems:“center”,justifyContent:“center”,
fontSize:15,fontWeight:900,color:”#000” }}>Q</div>
<span style={{ fontSize:16,fontWeight:800 }}>OMA <span style={{ color:”#FFD700” }}>QR</span></span>
<span style={{ fontSize:11,color:”#FFD700”,background:“rgba(255,215,0,0.12)”,
padding:“3px 8px”,borderRadius:6,marginLeft:4 }}>ADMIN</span>
</div>
<div style={{ display:“flex”,gap:8 }}>
<button onClick={()=>setShowScan(true)} style={{ padding:“7px 14px”,borderRadius:10,cursor:“pointer”,
background:“rgba(255,215,0,0.06)”,border:“1px solid rgba(255,215,0,0.25)”,color:”#FFD700”,fontSize:12,fontWeight:600 }}>
📷 Scanner
</button>
<button onClick={()=>setScreen(“landing”)} style={{ padding:“7px 14px”,borderRadius:10,cursor:“pointer”,
background:“rgba(255,255,255,0.04)”,border:“1px solid rgba(255,255,255,0.1)”,color:”#666”,fontSize:12 }}>
Déconnexion
</button>
</div>
</nav>

```
  <div style={{ padding:"24px",flex:1 }}>
    {/* Stats */}
    <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:14,marginBottom:28 }}>
      {[
        { label:"Utilisateurs", value:users.length, color:"#00FFFF" },
        { label:"Actifs",       value:users.filter(u=>u.status==="active").length, color:"#39ff14" },
        { label:"Bloqués",      value:users.filter(u=>u.status==="blocked").length, color:"#ff4455" },
        { label:"Total Scans",  value:totalScans, color:"#FFD700" },
      ].map(s=>(
        <div key={s.label} style={{ background:`${s.color}08`,border:`1px solid ${s.color}22`,
          borderRadius:14,padding:"16px 18px" }}>
          <div style={{ fontSize:26,fontWeight:900,color:s.color }}>{s.value}</div>
          <div style={{ fontSize:12,color:"#555",marginTop:2 }}>{s.label}</div>
        </div>
      ))}
    </div>

    {/* Users table */}
    <div style={{ background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:16,overflow:"hidden" }}>
      <div style={{ padding:"16px 20px",borderBottom:"1px solid rgba(255,255,255,0.06)",
        display:"flex",alignItems:"center",justifyContent:"space-between" }}>
        <span style={{ fontSize:13,fontWeight:700,color:"#fff" }}>Tous les clients</span>
        <span style={{ fontSize:12,color:"#555" }}>{users.length} comptes</span>
      </div>
      {users.map(u=>(
        <div key={u.id} style={{ display:"flex",alignItems:"center",gap:14,
          padding:"14px 20px",borderBottom:"1px solid rgba(255,255,255,0.04)",
          transition:"background .15s" }}
          onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.02)"}
          onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
          <div style={{ width:38,height:38,borderRadius:"50%",
            background:`${u.status==="active"?"rgba(0,255,255,0.1)":"rgba(255,68,85,0.1)"}`,
            border:`2px solid ${u.status==="active"?"rgba(0,255,255,0.3)":"rgba(255,68,85,0.3)"}`,
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:16,flexShrink:0 }}>
            {u.name.charAt(0)}
          </div>
          <div style={{ flex:1,minWidth:0 }}>
            <div style={{ fontSize:14,fontWeight:700,color:"#ddd" }}>{u.name}</div>
            <div style={{ fontSize:11,color:"#555" }}>{u.email} · inscrit {u.joined}</div>
          </div>
          <div style={{ fontSize:11,color:"#555",textAlign:"center",minWidth:60 }}>
            <div style={{ color:"#FFD700",fontWeight:700,fontSize:14 }}>{u.scans}</div>
            scans
          </div>
          <span style={{ fontSize:11,padding:"4px 10px",borderRadius:6,fontWeight:600,
            background: u.plan==="Luxe"?"rgba(255,215,0,0.1)":u.plan==="Pro"?"rgba(0,255,255,0.1)":"rgba(255,255,255,0.05)",
            color: u.plan==="Luxe"?"#FFD700":u.plan==="Pro"?"#00FFFF":"#666" }}>
            {u.plan}
          </span>
          <span style={{ fontSize:11,padding:"4px 10px",borderRadius:6,fontWeight:600,
            background: u.status==="active"?"rgba(57,255,20,0.1)":"rgba(255,68,85,0.1)",
            color: u.status==="active"?"#39ff14":"#ff4455" }}>
            {u.status==="active"?"● Actif":"● Bloqué"}
          </span>
          <div style={{ display:"flex",gap:6 }}>
            {u.status==="active"
              ? <button onClick={()=>block(u.id)} style={{ padding:"5px 10px",borderRadius:8,cursor:"pointer",fontSize:11,
                  background:"rgba(255,68,85,0.08)",border:"1px solid rgba(255,68,85,0.3)",color:"#ff6677" }}>Bloquer</button>
              : <button onClick={()=>unblock(u.id)} style={{ padding:"5px 10px",borderRadius:8,cursor:"pointer",fontSize:11,
                  background:"rgba(57,255,20,0.08)",border:"1px solid rgba(57,255,20,0.3)",color:"#39ff14" }}>Débloquer</button>
            }
            <button onClick={()=>remove(u.id)} style={{ padding:"5px 10px",borderRadius:8,cursor:"pointer",fontSize:11,
              background:"rgba(255,68,85,0.05)",border:"1px solid rgba(255,68,85,0.2)",color:"#ff4455" }}>Supprimer</button>
          </div>
        </div>
      ))}
    </div>
  </div>
</div>
```

);
}

/* ══════════════════════════════════════════════
CLIENT DASHBOARD
══════════════════════════════════════════════ */
function ClientDash({ authUser, users, setUsers, setScreen, setShowScan }) {
const user = users.find(u=>u.id===authUser.id) || authUser;
const [profile, setProfile] = useState(user.profile || { name:user.name,bio:””,avatar:null,template:“pro”,qrIdx:0,links:[],files:[],sections:[] });
const [tab, setTab]         = useState(“profil”);
const [customFg, setCustomFg] = useState(””);
const [newLink, setNewLink] = useState({ platform:“Instagram”,label:””,url:”” });
const [newFile, setNewFile] = useState({ label:””,url:””,tag:“PDF” });
const [newSec,  setNewSec]  = useState({ title:””,content:”” });
const avatarRef = useRef();

const T   = TEMPLATES[profile.template] || TEMPLATES.pro;
const qrP = customFg ? { fg:customFg, bg:QR_PALETTES[profile.qrIdx].bg } : QR_PALETTES[profile.qrIdx];
const slug = profile.name.toLowerCase().replace(/\s+/g,”-”);

const save = (p) => {
setProfile(p);
setUsers(u=>u.map(x=>x.id===user.id?{…x,profile:p}:x));
};

const inp = { width:“100%”,boxSizing:“border-box”,background:“rgba(255,255,255,0.05)”,
border:`1px solid ${T.border}`,borderRadius:8,color:”#fff”,padding:“9px 12px”,fontSize:13,outline:“none” };

const box = { background:T.btnBg,border:`1px solid ${T.border}`,borderRadius:16,padding:“18px 20px”,marginBottom:14 };

const TABS = [“profil”,“liens”,“fichiers”,“sections”,“qr”];

return (
<div style={{ minHeight:“100vh”,display:“flex”,flexDirection:“column” }}>
{/* Nav */}
<nav style={{ padding:“12px 20px”,borderBottom:“1px solid rgba(255,255,255,0.06)”,
background:“rgba(5,5,10,0.9)”,backdropFilter:“blur(20px)”,
display:“flex”,alignItems:“center”,gap:8,flexWrap:“wrap”,
position:“sticky”,top:0,zIndex:10 }}>
<div style={{ display:“flex”,alignItems:“center”,gap:8,marginRight:8 }}>
<div style={{ width:28,height:28,borderRadius:7,
background:`linear-gradient(135deg,${T.accent},#FFD700)`,
display:“flex”,alignItems:“center”,justifyContent:“center”,fontSize:13,fontWeight:900,color:”#000” }}>Q</div>
<span style={{ fontSize:15,fontWeight:800 }}>OMA <span style={{ color:T.accent }}>QR</span></span>
</div>
{TABS.map(t=>(
<button key={t} onClick={()=>setTab(t)} style={{
padding:“6px 13px”,borderRadius:20,cursor:“pointer”,fontSize:12,fontWeight:600,
background:tab===t?T.btnBg:“transparent”,
border:`1px solid ${tab===t?T.accent:"rgba(255,255,255,0.08)"}`,
color:tab===t?T.accent:”#555”,
}}>
{t===“profil”?“👤 Profil”:t===“liens”?“🔗 Liens”:t===“fichiers”?“📁 Fichiers”:t===“sections”?“📝 Sections”:“🎨 QR”}
</button>
))}
<div style={{ marginLeft:“auto”,display:“flex”,gap:6 }}>
<button onClick={()=>setShowScan(true)} style={{ padding:“6px 12px”,borderRadius:10,cursor:“pointer”,
background:“rgba(255,215,0,0.06)”,border:“1px solid rgba(255,215,0,0.25)”,color:”#FFD700”,fontSize:12,fontWeight:600 }}>
📷 Scanner
</button>
<button onClick={()=>setScreen(“landing”)} style={{ padding:“6px 12px”,borderRadius:10,cursor:“pointer”,
background:“rgba(255,255,255,0.04)”,border:“1px solid rgba(255,255,255,0.08)”,color:”#555”,fontSize:12 }}>
Déco
</button>
</div>
</nav>

```
  <div style={{ flex:1,display:"flex",gap:0 }}>
    {/* Editor */}
    <div style={{ flex:1,padding:"20px",overflowY:"auto",maxWidth:480 }}>

      {tab==="profil" && (
        <>
          <div style={box}>
            <div style={{ fontSize:10,letterSpacing:2,color:T.accent,marginBottom:12,textTransform:"uppercase" }}>Photo & Identité</div>
            <div style={{ display:"flex",gap:14,alignItems:"flex-start",marginBottom:14 }}>
              <div onClick={()=>avatarRef.current.click()} style={{ width:68,height:68,borderRadius:"50%",flexShrink:0,
                cursor:"pointer",border:`2px solid ${T.border}`,background:T.btnBg,overflow:"hidden",
                display:"flex",alignItems:"center",justifyContent:"center",
                boxShadow:`0 0 14px ${T.accent}33`,fontSize:26 }}>
                {profile.avatar?<img src={profile.avatar} style={{ width:"100%",height:"100%",objectFit:"cover" }}/>:"📷"}
              </div>
              <input ref={avatarRef} type="file" accept="image/*" style={{ display:"none" }}
                onChange={e=>{ const f=e.target.files[0]; if(f){ const r=new FileReader(); r.onload=ev=>save({...profile,avatar:ev.target.result}); r.readAsDataURL(f); }}}/>
              <div style={{ flex:1,display:"flex",flexDirection:"column",gap:8 }}>
                <input value={profile.name} onChange={e=>save({...profile,name:e.target.value})} placeholder="Ton nom" style={inp}/>
                <textarea value={profile.bio} onChange={e=>save({...profile,bio:e.target.value})}
                  placeholder="Ta bio (métier, ville, émoji...)" rows={2} style={{ ...inp,resize:"none",lineHeight:1.5 }}/>
              </div>
            </div>
          </div>
          <div style={box}>
            <div style={{ fontSize:10,letterSpacing:2,color:T.accent,marginBottom:12,textTransform:"uppercase" }}>Template</div>
            <div style={{ display:"flex",gap:7,flexWrap:"wrap" }}>
              {Object.entries(TEMPLATES).map(([k,v])=>(
                <button key={k} onClick={()=>save({...profile,template:k})} style={{
                  flex:1,minWidth:70,padding:"9px 6px",borderRadius:10,cursor:"pointer",
                  background:profile.template===k?v.btnBg:"rgba(255,255,255,0.03)",
                  border:`1px solid ${profile.template===k?v.accent:"rgba(255,255,255,0.07)"}`,
                  color:profile.template===k?v.accent:"#444",fontWeight:700,fontSize:11,
                  boxShadow:profile.template===k?`0 0 12px ${v.accent}33`:"none",
                }}>{v.name}</button>
              ))}
            </div>
          </div>
        </>
      )}

      {tab==="liens" && (
        <div style={box}>
          <div style={{ fontSize:10,letterSpacing:2,color:T.accent,marginBottom:12,textTransform:"uppercase" }}>Liens Sociaux</div>
          {profile.links.map(l=>(
            <div key={l.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"9px 12px",
              borderRadius:10,background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,marginBottom:7 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13,fontWeight:600,color:"#ddd" }}>{l.label}</div>
                <div style={{ fontSize:10,color:"#555",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{l.url}</div>
              </div>
              <button onClick={()=>save({...profile,links:profile.links.filter(x=>x.id!==l.id)})}
                style={{ background:"none",border:"none",color:"#ff4455",cursor:"pointer",fontSize:16,opacity:.7 }}>×</button>
            </div>
          ))}
          <div style={{ marginTop:12,display:"flex",flexDirection:"column",gap:8 }}>
            <select value={newLink.platform} onChange={e=>setNewLink({...newLink,platform:e.target.value})} style={inp}>
              {["WhatsApp","Instagram","TikTok","YouTube","Facebook","Lien perso"].map(p=><option key={p} value={p}>{p}</option>)}
            </select>
            <input value={newLink.label} onChange={e=>setNewLink({...newLink,label:e.target.value})} placeholder="Label du bouton" style={inp}/>
            <input value={newLink.url}   onChange={e=>setNewLink({...newLink,url:e.target.value})}   placeholder="https://..." style={inp}/>
            <button onClick={()=>{ if(!newLink.label||!newLink.url) return;
              save({...profile,links:[...profile.links,{...newLink,id:Date.now()}]});
              setNewLink({platform:"Instagram",label:"",url:""}); }}
              style={{ padding:"10px",borderRadius:10,cursor:"pointer",fontWeight:700,fontSize:13,
                background:T.btnBg,border:`1px solid ${T.accent}`,color:T.accent,
                boxShadow:`0 0 12px ${T.accent}22` }}>
              + Ajouter le lien
            </button>
          </div>
        </div>
      )}

      {tab==="fichiers" && (
        <div style={box}>
          <div style={{ fontSize:10,letterSpacing:2,color:T.accent,marginBottom:6,textTransform:"uppercase" }}>📁 Fichiers Dropbox</div>
          <div style={{ fontSize:12,color:"#555",marginBottom:14,lineHeight:1.6,
            background:"rgba(255,255,255,0.03)",padding:"10px 12px",borderRadius:8 }}>
            💡 Copie le lien de partage Dropbox → Colle ici → Bouton download sur ta page.
          </div>
          {profile.files.map(f=>(
            <div key={f.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"9px 12px",
              borderRadius:10,background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,marginBottom:7 }}>
              <span style={{ color:T.accent,fontSize:16 }}>⬇</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13,fontWeight:600,color:"#ddd" }}>{f.label}</div>
                <div style={{ fontSize:10,color:"#555",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{f.url}</div>
              </div>
              <span style={{ fontSize:10,color:T.accent,background:`${T.accent}18`,padding:"2px 7px",borderRadius:4,fontWeight:600 }}>{f.tag}</span>
              <button onClick={()=>save({...profile,files:profile.files.filter(x=>x.id!==f.id)})}
                style={{ background:"none",border:"none",color:"#ff4455",cursor:"pointer",fontSize:16,opacity:.7 }}>×</button>
            </div>
          ))}
          <div style={{ marginTop:12,display:"flex",flexDirection:"column",gap:8 }}>
            <input value={newFile.label} onChange={e=>setNewFile({...newFile,label:e.target.value})} placeholder="Nom du fichier" style={inp}/>
            <input value={newFile.url}   onChange={e=>setNewFile({...newFile,url:e.target.value})}   placeholder="Lien Dropbox (https://dropbox.com/s/...)" style={inp}/>
            <select value={newFile.tag}  onChange={e=>setNewFile({...newFile,tag:e.target.value})} style={inp}>
              {["PDF","Image","Vidéo","ZIP","Audio","Autre"].map(t=><option key={t} value={t}>{t}</option>)}
            </select>
            <button onClick={()=>{ if(!newFile.label||!newFile.url) return;
              save({...profile,files:[...profile.files,{...newFile,id:Date.now()}]});
              setNewFile({label:"",url:"",tag:"PDF"}); }}
              style={{ padding:"10px",borderRadius:10,cursor:"pointer",fontWeight:700,fontSize:13,
                background:T.btnBg,border:`1px solid ${T.accent}`,color:T.accent }}>
              + Ajouter le fichier
            </button>
          </div>
        </div>
      )}

      {tab==="sections" && (
        <div style={box}>
          <div style={{ fontSize:10,letterSpacing:2,color:T.accent,marginBottom:6,textTransform:"uppercase" }}>📝 Blocs de Contenu</div>
          <div style={{ fontSize:12,color:"#555",marginBottom:14 }}>À propos, Services, Tarifs, Contact...</div>
          {profile.sections.map(s=>(
            <div key={s.id} style={{ padding:"11px 14px",borderRadius:10,
              background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,marginBottom:8 }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4 }}>
                <span style={{ fontSize:12,fontWeight:700,color:T.accent }}>{s.title}</span>
                <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                  <label style={{ display:"flex",alignItems:"center",gap:4,fontSize:11,color:"#666",cursor:"pointer" }}>
                    <input type="checkbox" checked={s.visible}
                      onChange={()=>save({...profile,sections:profile.sections.map(x=>x.id===s.id?{...x,visible:!x.visible}:x)})}/>
                    visible
                  </label>
                  <button onClick={()=>save({...profile,sections:profile.sections.filter(x=>x.id!==s.id)})}
                    style={{ background:"none",border:"none",color:"#ff4455",cursor:"pointer",fontSize:15,opacity:.7 }}>×</button>
                </div>
              </div>
              <div style={{ fontSize:11,color:"#777" }}>{s.content}</div>
            </div>
          ))}
          <div style={{ marginTop:12,display:"flex",flexDirection:"column",gap:8 }}>
            <input value={newSec.title}   onChange={e=>setNewSec({...newSec,title:e.target.value})}   placeholder="Titre (ex: Mes Services)" style={inp}/>
            <textarea value={newSec.content} onChange={e=>setNewSec({...newSec,content:e.target.value})}
              placeholder="Contenu du bloc..." rows={3} style={{ ...inp,resize:"none" }}/>
            <button onClick={()=>{ if(!newSec.title||!newSec.content) return;
              save({...profile,sections:[...profile.sections,{...newSec,id:Date.now(),visible:true}]});
              setNewSec({title:"",content:""}); }}
              style={{ padding:"10px",borderRadius:10,cursor:"pointer",fontWeight:700,fontSize:13,
                background:T.btnBg,border:`1px solid ${T.accent}`,color:T.accent }}>
              + Ajouter le bloc
            </button>
          </div>
        </div>
      )}

      {tab==="qr" && (
        <div style={box}>
          <div style={{ fontSize:10,letterSpacing:2,color:T.accent,marginBottom:14,textTransform:"uppercase" }}>🎨 Personnalise ton QR</div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:18 }}>
            {QR_PALETTES.map((p,i)=>(
              <button key={i} onClick={()=>{ save({...profile,qrIdx:i}); setCustomFg(""); }} style={{
                padding:"9px 5px",borderRadius:10,cursor:"pointer",textAlign:"center",
                background:profile.qrIdx===i&&!customFg?`${p.fg}18`:"rgba(255,255,255,0.03)",
                border:`1px solid ${profile.qrIdx===i&&!customFg?p.fg:"rgba(255,255,255,0.07)"}`,
                boxShadow:profile.qrIdx===i&&!customFg?`0 0 12px ${p.fg}44`:"none",
              }}>
                <div style={{ width:26,height:26,borderRadius:6,background:p.bg,border:`2px solid ${p.fg}`,
                  margin:"0 auto 4px",boxShadow:`0 0 6px ${p.fg}55` }}/>
                <div style={{ fontSize:9,color:profile.qrIdx===i&&!customFg?p.fg:"#444",fontWeight:600,lineHeight:1.2 }}>{p.name}</div>
              </button>
            ))}
          </div>
          <div style={{ fontSize:11,color:"#555",marginBottom:8 }}>Couleur custom</div>
          <div style={{ display:"flex",gap:10,alignItems:"center",marginBottom:20 }}>
            <input type="color" value={customFg||QR_PALETTES[profile.qrIdx].fg} onChange={e=>setCustomFg(e.target.value)}
              style={{ width:46,height:38,borderRadius:8,border:`1px solid ${T.border}`,background:"none",cursor:"pointer",padding:2 }}/>
            <input value={customFg} onChange={e=>setCustomFg(e.target.value)} placeholder="#FF6600" style={{ ...inp,flex:1 }}/>
            {customFg && <button onClick={()=>setCustomFg("")} style={{ background:"none",border:"none",color:"#666",cursor:"pointer",fontSize:18 }}>×</button>}
          </div>
          <div style={{ textAlign:"center" }}>
            <div style={{ display:"inline-block",padding:14,borderRadius:14,
              background:qrP.bg,border:`1px solid ${qrP.fg}44`,boxShadow:`0 0 28px ${qrP.fg}33` }}>
              <QRCanvas text={`omaqr.io/${slug}`} fg={qrP.fg} bg={qrP.bg} size={160}/>
            </div>
            <div style={{ fontSize:10,color:"#555",marginTop:8 }}>omaqr.io/{slug}</div>
          </div>
        </div>
      )}
    </div>

    {/* Divider */}
    <div style={{ width:1,background:"rgba(255,255,255,0.05)",flexShrink:0 }}/>

    {/* Preview */}
    <div style={{ flex:1,padding:"20px",display:"flex",flexDirection:"column",alignItems:"center",gap:18,overflowY:"auto" }}>
      <div style={{ fontSize:10,letterSpacing:2,color:"#333",textTransform:"uppercase" }}>
        Aperçu · Ce que voit le client après scan
      </div>
      <PhonePreview T={T} profile={profile}/>
      <div style={{ background:T.btnBg,border:`1px solid ${T.border}`,borderRadius:14,
        padding:"16px 20px",textAlign:"center" }}>
        <div style={{ fontSize:9,letterSpacing:2,color:T.accent,marginBottom:10,textTransform:"uppercase" }}>QR Code Final</div>
        <div style={{ display:"inline-block",padding:10,borderRadius:12,
          background:qrP.bg,border:`1px solid ${qrP.fg}44`,boxShadow:`0 0 20px ${qrP.fg}33` }}>
          <QRCanvas text={`omaqr.io/${slug}`} fg={qrP.fg} bg={qrP.bg} size={120}/>
        </div>
        <div style={{ fontSize:10,color:"#444",marginTop:8 }}>omaqr.io/{slug}</div>
      </div>
    </div>
  </div>
</div>
```

);
}
