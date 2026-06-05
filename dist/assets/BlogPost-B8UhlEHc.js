import{j as e,L as f}from"./index-CGjzLzVb.js";import{i as h,r as l,L as s}from"./router-Byz_4G-x.js";import{u as y}from"./useSEO-Dcq5YC09.js";import{u as v}from"./i18n-BtEExYVz.js";import"./charts-BO8EO0sX.js";const b="https://artalpha-backend-production.up.railway.app";function j(a){return a?new Date(a).toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"}):""}function B(){var p;const{slug:a}=h(),{i18n:d}=v(),o=(p=d.language)!=null&&p.startsWith("fr")?"fr":"en",[t,c]=l.useState(null),[x,g]=l.useState(!0),[m,u]=l.useState(""),n=r=>{if(!r)return"";if(typeof r!="string")return String(r);try{const i=JSON.parse(r);if(typeof i=="object"&&i!==null)return i[o]||i.en||i.fr||r}catch{}return r};return y({title:t?`${n(t.title)} · Nautilus`:"Art Market Intelligence · Nautilus",description:t?n(t.excerpt):"Art market analysis and investment signals from Nautilus.",image:(t==null?void 0:t.cover_image)||void 0,ogType:"article",schema:t?{"@context":"https://schema.org","@type":"Article",headline:n(t.title),description:n(t.excerpt),image:t.cover_image,author:{"@type":"Person",name:t.author},datePublished:t.published_at,publisher:{"@type":"Organization",name:"Nautilus",url:"https://get-nautilus.com"}}:void 0}),l.useEffect(()=>{const r="nautilus-blog-fonts";if(!document.getElementById(r)){const i=document.createElement("link");i.id=r,i.rel="stylesheet",i.href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Source+Serif+4:ital,wght@0,300;0,400;1,300&family=DM+Mono:wght@400;500&display=swap",document.head.appendChild(i)}},[]),l.useEffect(()=>{a&&fetch(`${b}/api/blog/${a}`).then(r=>{if(!r.ok)throw new Error("Not found");return r.json()}).then(c).catch(()=>u("Post not found")).finally(()=>g(!1))},[a]),e.jsxs("div",{style:{background:"var(--bg)",minHeight:"100vh"},children:[e.jsxs("header",{style:{position:"sticky",top:0,zIndex:50,background:"rgba(255,255,255,0.97)",backdropFilter:"blur(12px)",borderBottom:"1px solid var(--border)",height:"64px",padding:"0 40px",display:"flex",alignItems:"center",justifyContent:"space-between"},children:[e.jsx(s,{to:"/",style:{textDecoration:"none"},children:e.jsx(f,{variant:"horizontal",color:"dark",size:24})}),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"16px"},children:[e.jsx("div",{style:{display:"flex",gap:"2px",background:"var(--bg-subtle)",borderRadius:"6px",padding:"2px",border:"1px solid var(--border)"},children:["fr","en"].map(r=>e.jsx("button",{onClick:()=>{d.changeLanguage(r),localStorage.setItem("i18nextLng",r)},style:{padding:"4px 10px",borderRadius:"4px",border:"none",cursor:"pointer",fontSize:"11px",fontWeight:700,fontFamily:"var(--font-mono)",letterSpacing:"0.08em",background:o===r?"var(--navy)":"transparent",color:o===r?"white":"var(--text-3)",transition:"all 0.15s"},children:r.toUpperCase()},r))}),e.jsx(s,{to:"/blog",style:{fontSize:"13px",color:"var(--text-2)",textDecoration:"none"},children:o==="fr"?"← Tous les articles":"← All articles"})]})]}),x&&e.jsxs("div",{style:{maxWidth:"720px",margin:"64px auto",padding:"0 40px"},children:[e.jsx("div",{className:"skeleton",style:{height:"40px",marginBottom:"16px",borderRadius:"6px"}}),e.jsx("div",{className:"skeleton",style:{height:"20px",width:"60%",marginBottom:"32px",borderRadius:"4px"}}),e.jsx("div",{className:"skeleton",style:{height:"300px",borderRadius:"8px"}})]}),m&&e.jsxs("div",{style:{maxWidth:"720px",margin:"80px auto",padding:"0 40px",textAlign:"center"},children:[e.jsx("div",{style:{fontSize:"32px",marginBottom:"16px"},children:"◆"}),e.jsx("h1",{style:{fontFamily:"var(--font-serif)",fontSize:"24px",color:"var(--text)",marginBottom:"12px"},children:o==="fr"?"Article introuvable":"Article not found"}),e.jsx(s,{to:"/blog",style:{color:"var(--navy)",fontWeight:600},children:o==="fr"?"← Retour au blog":"← Back to the blog"})]}),t&&e.jsxs("article",{style:{maxWidth:"720px",margin:"0 auto",padding:"56px 40px 80px"},children:[Array.isArray(t.tags)&&t.tags.length>0&&e.jsx("div",{style:{display:"flex",gap:"6px",marginBottom:"16px",flexWrap:"wrap"},children:t.tags.map(r=>e.jsx("span",{style:{fontSize:"9px",fontWeight:700,color:"var(--gold-dim)",background:"var(--gold-subtle)",border:"1px solid var(--gold-border)",borderRadius:"20px",padding:"2px 8px",letterSpacing:"0.1em",fontFamily:"var(--font-mono)",textTransform:"uppercase"},children:r},r))}),e.jsx("h1",{style:{fontFamily:"var(--font-serif)",fontSize:"38px",fontWeight:700,color:"var(--text)",margin:"0 0 16px",lineHeight:1.25},children:n(t.title)}),t.excerpt&&e.jsx("p",{style:{fontSize:"17px",color:"var(--text-2)",margin:"0 0 24px",lineHeight:1.7,borderLeft:"3px solid var(--gold)",paddingLeft:"16px"},children:n(t.excerpt)}),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"12px",marginBottom:"32px",paddingBottom:"24px",borderBottom:"1px solid var(--border)"},children:[e.jsx("div",{style:{width:"32px",height:"32px",borderRadius:"50%",background:"var(--navy)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"12px",color:"white",fontWeight:700},children:"N"}),e.jsxs("div",{children:[e.jsx("div",{style:{fontSize:"13px",fontWeight:600,color:"var(--text)"},children:t.author}),e.jsxs("div",{style:{fontSize:"11px",color:"var(--text-3)",fontFamily:"var(--font-mono)"},children:[j(t.published_at),t.read_time_minutes?` · ${t.read_time_minutes} min ${o==="fr"?"de lecture":"read"}`:""]})]})]}),t.cover_image&&e.jsx("div",{style:{margin:"0 0 32px",borderRadius:"8px",overflow:"hidden"},children:e.jsx("img",{src:t.cover_image,alt:"",style:{width:"100%",display:"block"}})}),e.jsx("style",{children:`
            .nautilus-prose p {
              margin: 0 0 1.5em;
              color: var(--text);
            }
            .nautilus-prose h2 {
              font-family: var(--font-serif);
              font-size: 22px;
              font-weight: 700;
              color: var(--text);
              margin: 2.4em 0 0.7em;
              line-height: 1.3;
              letter-spacing: -0.01em;
            }
            .nautilus-prose h3 {
              font-family: var(--font-serif);
              font-size: 18px;
              font-weight: 600;
              color: var(--text);
              margin: 2em 0 0.5em;
              line-height: 1.35;
            }
            .nautilus-prose strong {
              font-weight: 700;
              color: var(--text);
            }
            .nautilus-prose em {
              font-style: italic;
              color: var(--text-2);
            }
            .nautilus-prose ul, .nautilus-prose ol {
              margin: 0 0 1.5em 1.25em;
              padding: 0;
            }
            .nautilus-prose li {
              margin-bottom: 0.5em;
              color: var(--text);
            }
            .nautilus-prose a {
              color: var(--navy);
              text-decoration: underline;
              text-underline-offset: 3px;
            }
            .nautilus-prose blockquote {
              border-left: 3px solid var(--gold);
              margin: 1.5em 0;
              padding: 0.25em 0 0.25em 1.25em;
              color: var(--text-2);
              font-style: italic;
            }
            .nautilus-prose hr {
              border: none;
              border-top: 1px solid var(--border);
              margin: 2.5em 0;
            }
          `}),e.jsx("div",{className:"nautilus-prose",style:{fontSize:"16px",lineHeight:1.85},dangerouslySetInnerHTML:{__html:n(t.content)}}),e.jsxs("div",{style:{marginTop:"56px",padding:"32px",background:"var(--navy)",borderRadius:"12px",textAlign:"center"},children:[e.jsx("div",{style:{fontSize:"10px",fontWeight:700,color:"rgba(255,255,255,0.4)",fontFamily:"var(--font-mono)",letterSpacing:"0.16em",marginBottom:"12px"},children:o==="fr"?"ACCÉDER À LA PLATEFORME":"ACCESS THE FULL PLATFORM"}),e.jsx("div",{style:{fontFamily:"var(--font-serif)",fontSize:"22px",color:"white",marginBottom:"8px"},children:o==="fr"?"Voyez ces signaux en direct sur Nautilus":"See these signals live in Nautilus"}),e.jsx("p",{style:{fontSize:"13px",color:"rgba(255,255,255,0.55)",marginBottom:"20px"},children:o==="fr"?"1,5M+ lots analysés · Score de conviction IA · Alertes en temps réel":"1.5M+ lots analyzed · AI-powered deal scoring · Real-time alerts"}),e.jsx(s,{to:"/app/signup",style:{display:"inline-block",background:"var(--gold)",color:"var(--navy)",padding:"12px 28px",borderRadius:"8px",textDecoration:"none",fontSize:"13px",fontWeight:700},children:o==="fr"?"Commencer gratuitement →":"Start free →"})]})]}),e.jsx("footer",{style:{padding:"32px 40px",textAlign:"center",background:"var(--bg-subtle)",borderTop:"1px solid var(--border)"},children:e.jsxs("div",{style:{fontSize:"12px",color:"var(--text-3)",fontFamily:"var(--font-mono)"},children:["© 2026 Nautilus · ",e.jsx(s,{to:"/legal/privacy",style:{color:"var(--text-3)",textDecoration:"none"},children:"Privacy"})," · ",e.jsx(s,{to:"/legal/terms",style:{color:"var(--text-3)",textDecoration:"none"},children:"Terms"})]})})]})}export{B as default};
