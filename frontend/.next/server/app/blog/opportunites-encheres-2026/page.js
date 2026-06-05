(()=>{var e={};e.id=864,e.ids=[864],e.modules={72934:e=>{"use strict";e.exports=require("next/dist/client/components/action-async-storage.external.js")},54580:e=>{"use strict";e.exports=require("next/dist/client/components/request-async-storage.external.js")},45869:e=>{"use strict";e.exports=require("next/dist/client/components/static-generation-async-storage.external.js")},20399:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},27790:e=>{"use strict";e.exports=require("assert")},84770:e=>{"use strict";e.exports=require("crypto")},17702:e=>{"use strict";e.exports=require("events")},92048:e=>{"use strict";e.exports=require("fs")},32615:e=>{"use strict";e.exports=require("http")},32694:e=>{"use strict";e.exports=require("http2")},35240:e=>{"use strict";e.exports=require("https")},19801:e=>{"use strict";e.exports=require("os")},55315:e=>{"use strict";e.exports=require("path")},76162:e=>{"use strict";e.exports=require("stream")},74175:e=>{"use strict";e.exports=require("tty")},17360:e=>{"use strict";e.exports=require("url")},21764:e=>{"use strict";e.exports=require("util")},71568:e=>{"use strict";e.exports=require("zlib")},6946:(e,t,s)=>{"use strict";s.r(t),s.d(t,{GlobalError:()=>a.a,__next_app__:()=>d,originalPathname:()=>c,pages:()=>p,routeModule:()=>m,tree:()=>u}),s(56234),s(39693),s(90996);var r=s(30170),i=s(45002),n=s(83876),a=s.n(n),o=s(66299),l={};for(let e in o)0>["default","tree","pages","GlobalError","originalPathname","__next_app__","routeModule"].indexOf(e)&&(l[e]=()=>o[e]);s.d(t,l);let u=["",{children:["blog",{children:["opportunites-encheres-2026",{children:["__PAGE__",{},{page:[()=>Promise.resolve().then(s.bind(s,56234)),"/Users/camillefroment/Documents/Claude code/artalpha-figma/frontend/app/blog/opportunites-encheres-2026/page.tsx"]}]},{}]},{}]},{layout:[()=>Promise.resolve().then(s.bind(s,39693)),"/Users/camillefroment/Documents/Claude code/artalpha-figma/frontend/app/layout.tsx"],"not-found":[()=>Promise.resolve().then(s.t.bind(s,90996,23)),"next/dist/client/components/not-found-error"]}],p=["/Users/camillefroment/Documents/Claude code/artalpha-figma/frontend/app/blog/opportunites-encheres-2026/page.tsx"],c="/blog/opportunites-encheres-2026/page",d={require:s,loadChunk:()=>Promise.resolve()},m=new r.AppPageRouteModule({definition:{kind:i.x.APP_PAGE,page:"/blog/opportunites-encheres-2026/page",pathname:"/blog/opportunites-encheres-2026",bundlePath:"",filename:"",appPaths:[]},userland:{loaderTree:u}})},52880:(e,t,s)=>{Promise.resolve().then(s.bind(s,18473))},77824:(e,t,s)=>{Promise.resolve().then(s.t.bind(s,63642,23)),Promise.resolve().then(s.t.bind(s,87586,23)),Promise.resolve().then(s.t.bind(s,47838,23)),Promise.resolve().then(s.t.bind(s,58057,23)),Promise.resolve().then(s.t.bind(s,77741,23)),Promise.resolve().then(s.t.bind(s,13118,23))},35303:()=>{},18473:(e,t,s)=>{"use strict";s.d(t,{PlanSync:()=>i}),s(28964);var r=s(72697);function i(){let{isAuthenticated:e,setPlan:t}=(0,r.t)();return null}s(68920)},68920:(e,t,s)=>{"use strict";s.d(t,{Ol:()=>l,YE:()=>o,a2:()=>p,g6:()=>a,hi:()=>n,iJ:()=>c,nJ:()=>d,zw:()=>u});var r=s(83128),i=s(72266);let n=r.Z.create({baseURL:"http://localhost:8000",timeout:15e3});n.interceptors.request.use(e=>{let t=i.Z.get("hono_token")||!1;return t&&(e.headers.Authorization=`Bearer ${t}`),e}),n.interceptors.response.use(e=>e,e=>(e.response?.status===401&&i.Z.remove("hono_token"),Promise.reject(e)));let a={list:e=>n.get("/api/lots",{params:e}),get:e=>n.get(`/api/lots/${e}`),topDeals:(e=10)=>n.get("/api/lots/top-deals",{params:{limit:e}}),hotDeals:(e=30,t=70)=>n.get("/api/lots/hot-deals",{params:{limit:e,min_score:t}}),stats:()=>n.get("/api/lots/stats"),categories:()=>n.get("/api/lots/categories"),trending:e=>n.get("/api/lots/trending",{params:e}),missed:e=>n.get("/api/lots/missed",{params:e}),comparables:e=>n.get(`/api/lots/${e}/comparables`),similar:e=>n.get(`/api/lots/${e}/similar`)},o={ids:()=>n.get("/api/wishlist/ids"),list:()=>n.get("/api/wishlist"),add:e=>n.post(`/api/wishlist/${e}`),remove:e=>n.delete(`/api/wishlist/${e}`)},l={list:e=>n.get("/api/alerts",{params:e}),delete:e=>n.delete(`/api/alerts/${e}`)},u={get:()=>n.get("/api/preferences"),update:e=>n.patch("/api/preferences",e)},p={list:e=>n.get("/api/artists",{params:e}),get:e=>n.get(`/api/artists/${e}`),oracle:e=>n.get(`/api/artists/${e}/oracle`)},c={login:(e,t)=>n.post("/api/auth/login",{email:e,password:t}),register:(e,t,s)=>n.post("/api/auth/register",{email:e,password:t,full_name:s}),me:()=>n.get("/api/auth/me")},d={list:()=>n.get("/api/portfolio"),get:e=>n.get(`/api/portfolio/${e}`),add:e=>n.post("/api/portfolio",e),update:(e,t)=>n.patch(`/api/portfolio/${e}`,t),remove:e=>n.delete(`/api/portfolio/${e}`)}},72697:(e,t,s)=>{"use strict";s.d(t,{t:()=>a});var r=s(99713),i=s(92377),n=s(72266);let a=(0,r.U)()((0,i.tJ)(e=>({user:null,token:null,plan:"free",isAuthenticated:!1,setAuth:(t,s)=>{n.Z.set("hono_token",s,{expires:7,sameSite:"strict"}),e({user:t,token:s,isAuthenticated:!0})},setPlan:t=>e({plan:t}),logout:()=>{n.Z.remove("hono_token"),e({user:null,token:null,plan:"free",isAuthenticated:!1})}}),{name:"hono-auth",partialize:e=>({user:e.user,token:e.token,plan:e.plan,isAuthenticated:e.isAuthenticated})}))},56234:(e,t,s)=>{"use strict";s.r(t),s.d(t,{default:()=>a,metadata:()=>i});var r=s(72051);let i={title:"Les meilleures opportunit\xe9s d'art aux ench\xe8res en 2026 \xb7 Nautilus",description:"O\xf9 et comment trouver les meilleures opportunit\xe9s sur le march\xe9 de l'art aux ench\xe8res en 2026. Le guide des ventes \xe0 surveiller que personne ne publie.",alternates:{canonical:"https://get-nautilus.com/blog/opportunites-encheres-2026",languages:{en:"/blog/art-auction-opportunities-2026"}},openGraph:{title:"Les meilleures opportunit\xe9s d'art aux ench\xe8res en 2026",description:"O\xf9 et comment trouver les meilleures opportunit\xe9s sur le march\xe9 de l'art aux ench\xe8res en 2026.",type:"article",locale:"fr_FR",url:"https://get-nautilus.com/blog/opportunites-encheres-2026",siteName:"Nautilus"}},n=`
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Source+Serif+4:ital,wght@0,300;0,400;1,300&family=DM+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --navy: #0F1923;
    --gold: #C6A85A;
    --text: #1A1A1A;
    --text-2: #3D3D3D;
    --text-3: #7A7A7A;
    --bg: #FAFAF8;
    --border: #E8E4DD;
  }

  body {
    font-family: 'Source Serif 4', Georgia, serif;
    font-weight: 300;
    background: var(--bg);
    color: var(--text);
    line-height: 1.85;
    font-size: 17px;
  }

  .article-wrap {
    max-width: 680px;
    margin: 0 auto;
    padding: 64px 24px 80px;
  }

  h1 {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: clamp(28px, 5vw, 42px);
    font-weight: 700;
    color: var(--navy);
    line-height: 1.2;
    margin-bottom: 32px;
    letter-spacing: -0.01em;
  }

  .chapeau {
    font-family: 'Source Serif 4', Georgia, serif;
    font-size: 19px;
    font-weight: 300;
    font-style: italic;
    color: var(--text-2);
    line-height: 1.75;
    margin-bottom: 40px;
    padding-bottom: 40px;
    border-bottom: 1px solid var(--border);
  }

  p {
    margin-bottom: 22px;
    color: var(--text-2);
  }

  h2 {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: clamp(20px, 3vw, 26px);
    font-weight: 600;
    color: var(--navy);
    line-height: 1.3;
    margin-top: 52px;
    margin-bottom: 18px;
    padding-left: 20px;
    border-left: 3px solid var(--gold);
    letter-spacing: -0.01em;
  }

  h2 .num {
    font-family: 'DM Mono', monospace;
    font-size: 13px;
    font-weight: 500;
    color: var(--gold);
    letter-spacing: 0.1em;
    display: block;
    margin-bottom: 4px;
  }

  .nautilus-section {
    background: var(--navy);
    border-radius: 10px;
    padding: 36px 40px;
    margin: 52px 0 40px;
  }

  .nautilus-section .section-label {
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.22em;
    color: var(--gold);
    text-transform: uppercase;
    margin-bottom: 20px;
  }

  .nautilus-section h3 {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 22px;
    font-weight: 600;
    color: #F0EDE6;
    margin-bottom: 20px;
    line-height: 1.3;
  }

  .nautilus-section p {
    color: rgba(255,255,255,0.72);
    font-size: 15px;
    line-height: 1.75;
    margin-bottom: 16px;
  }

  .nautilus-section ul {
    list-style: none;
    margin: 20px 0 24px;
    padding: 0;
  }

  .nautilus-section ul li {
    color: rgba(255,255,255,0.75);
    font-size: 15px;
    line-height: 1.7;
    padding: 6px 0 6px 20px;
    position: relative;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }

  .nautilus-section ul li:last-child {
    border-bottom: none;
  }

  .nautilus-section ul li::before {
    content: '◆';
    position: absolute;
    left: 0;
    color: var(--gold);
    font-size: 9px;
    top: 10px;
  }

  .nautilus-section .cta-link {
    display: inline-block;
    margin-top: 8px;
    font-family: 'DM Mono', monospace;
    font-size: 12px;
    font-weight: 500;
    color: var(--gold);
    text-decoration: none;
    letter-spacing: 0.08em;
    border-bottom: 1px solid rgba(198,168,90,0.4);
    padding-bottom: 2px;
  }

  .nautilus-section .disclaimer {
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid rgba(255,255,255,0.08);
    font-size: 12px;
    color: rgba(255,255,255,0.35);
    font-style: italic;
    line-height: 1.6;
  }

  .sources {
    margin-top: 48px;
    padding-top: 24px;
    border-top: 1px solid var(--border);
    font-size: 12px;
    font-style: italic;
    color: var(--text-3);
    line-height: 1.8;
  }

  .sources strong {
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-3);
    font-style: normal;
    display: block;
    margin-bottom: 8px;
  }

  .note {
    background: #FFFBF0;
    border-left: 3px solid var(--gold);
    border-radius: 0 6px 6px 0;
    padding: 14px 18px;
    margin: 20px 0;
    font-size: 15px;
    color: var(--text-2);
    font-style: italic;
  }

  .note strong {
    font-style: normal;
    color: var(--navy);
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    display: block;
    margin-bottom: 6px;
  }
`;function a(){return(0,r.jsxs)(r.Fragment,{children:[r.jsx("style",{dangerouslySetInnerHTML:{__html:n}}),(0,r.jsxs)("article",{className:"article-wrap",children:[r.jsx("h1",{children:"Les meilleures opportunit\xe9s d'art aux ench\xe8res en 2026 : le guide des ventes \xe0 surveiller"}),r.jsx("p",{className:"chapeau",children:"Tout le monde conna\xeet les grandes salles de vente parisiennes ou londoniennes. Mais les collectionneurs qui font les meilleures affaires ne sont pas ceux qui suivent les vacations les plus m\xe9diatis\xe9es. Ce sont ceux qui savent exactement o\xf9 regarder — et pourquoi certaines typologies de ventes cr\xe9ent structurellement plus d'opportunit\xe9s que d'autres."}),r.jsx("p",{children:"Le march\xe9 mondial de l'art repr\xe9sente plus de 60 milliards de dollars par an, mais l'immense majorit\xe9 des inefficiences de prix se jouent loin des projecteurs. Plus de la moiti\xe9 des lots vendus aux ench\xe8res dans le monde s'\xe9changent sous la barre des 5 000 dollars. C'est dans cette masse de donn\xe9es que se trouvent les v\xe9ritables opportunit\xe9s."}),r.jsx("p",{children:"Voici la grille de lecture que personne ne publie."}),(0,r.jsxs)("h2",{children:[r.jsx("span",{className:"num",children:"01 —"}),"Les grandes maisons internationales : la r\xe9f\xe9rence, pas le terrain de jeu"]}),r.jsx("p",{children:"Les grandes enseignes internationales fixent les standards du march\xe9. Transparence, expertises pointues, catalogues exhaustifs, garanties solides — elles offrent un niveau de s\xe9curit\xe9 in\xe9gal\xe9 pour l'acheteur. Mais c'est pr\xe9cis\xe9ment cette visibilit\xe9 mondiale qui les rend moins propices aux asym\xe9tries de prix."}),r.jsx("p",{children:"Leurs prestigieuses ventes du soir b\xe9n\xe9ficient d'une diffusion mondiale en temps r\xe9el. Des acheteurs de New York, Hong Kong, Londres et Paris ench\xe9rissent simultan\xe9ment sur le m\xeame lot. Cette comp\xe9tition ultra-centralis\xe9e pousse m\xe9caniquement les prix vers leur valeur juste — voire au-del\xe0, sous l'effet du prestige de la salle."}),r.jsx("p",{children:"O\xf9 regarder malgr\xe9 tout : concentrez-vous sur leurs ventes de jour (Day Sales) et leurs sessions exclusivement en ligne (Online Only). Moins m\xe9diatis\xe9es, d\xe9laiss\xe9es par les grands acheteurs institutionnels, elles affichent parfois des \xe9carts significatifs sur des lots de qualit\xe9 comparable. Un lot qui n'atteignait pas le seuil d'une vente du soir peut se retrouver dans une vacation de jour — m\xeame artiste, m\xeame qualit\xe9, audience beaucoup plus restreinte."}),(0,r.jsxs)("h2",{children:[r.jsx("span",{className:"num",children:"02 —"}),"Les maisons r\xe9gionales europ\xe9ennes : le vrai terrain de jeu"]}),r.jsx("p",{children:"C'est ici que se cachent les meilleures opportunit\xe9s pour l'acheteur inform\xe9."}),r.jsx("p",{children:"Les grandes structures r\xe9gionales — qu'elles soient scandinaves, du Benelux, d'Europe centrale ou des provinces fran\xe7aises — op\xe8rent principalement sur des bassins d'acheteurs locaux. Un artiste dont la cote est bien \xe9tablie \xe0 Paris ou Londres peut y \xeatre largement sous-\xe9valu\xe9, simplement parce que le public local ne ma\xeetrise pas son march\xe9 secondaire."}),r.jsx("p",{children:"Le m\xe9canisme est direct : moins de visibilit\xe9 internationale \xe9quivaut \xe0 moins de comp\xe9tition, et donc \xe0 des prix d'entr\xe9e structurellement plus bas pour une qualit\xe9 \xe9quivalente."}),r.jsx("p",{children:"Ce qu'il faut cibler : les ventes th\xe9matiques (estampes, art moderne europ\xe9en, design) dans ces structures r\xe9gionales fortes. Les fen\xeatres de sous-pression : les vacations organis\xe9es \xe0 la mi-ao\xfbt ou d\xe9but janvier, p\xe9riodes creuses o\xf9 les professionnels coupent leurs alertes. Les lots d'artistes \xe0 rayonnement international \xe9gar\xe9s dans des inventaires locaux."}),(0,r.jsxs)("div",{className:"note",children:[r.jsx("strong",{children:"Note de vigilance"}),"La pr\xe9cision des rapports de condition peut \xeatre variable. Exigez des photos d\xe9taill\xe9es des revers et, pour les achats importants, un rapport d'\xe9tat \xe9crit avant d'engager votre capital."]}),(0,r.jsxs)("h2",{children:[r.jsx("span",{className:"num",children:"03 —"}),"Les agr\xe9gateurs en ligne : volume, bruit et vigilance"]}),r.jsx("p",{children:"Les plateformes num\xe9riques qui agr\xe8gent des centaines de maisons de vente r\xe9gionales ont profond\xe9ment transform\xe9 l'acc\xe8s au march\xe9 secondaire. Depuis votre bureau, vous pouvez suivre des ventes \xe0 Stockholm, Francfort ou Lisbonne simultan\xe9ment. L'avantage est \xe9vident : une exposition massive \xe0 des opportunit\xe9s invisibles autrement."}),r.jsx("p",{children:"Les pi\xe8ges structurels \xe0 int\xe9grer : Les frais de plateforme cach\xe9s. La plupart des agr\xe9gateurs ajoutent leurs propres frais de courtage en ligne — g\xe9n\xe9ralement 3% \xe0 5% — en plus des frais acheteur de la maison de vente (20% \xe0 30%). Le droit de suite. En Europe, n'oubliez pas d'anticiper le droit de suite — redevance due aux h\xe9ritiers des artistes d\xe9c\xe9d\xe9s depuis moins de 70 ans, calcul\xe9e par tranches d\xe9gressives de 4% \xe0 0,25% du prix marteau. Un poste souvent oubli\xe9 qui peut repr\xe9senter plusieurs centaines d'euros sur un achat interm\xe9diaire. Le bruit visuel. Sans outils de filtrage algorithmique, vous passerez des heures \xe0 trier des centaines de lots sans int\xe9r\xeat pour trouver la p\xe9pite."}),r.jsx("p",{children:"La bonne approche : utilisez ces plateformes pour la d\xe9couverte. Ench\xe9rissez directement sur le site de la maison de vente quand c'est possible pour \xe9viter les frais suppl\xe9mentaires."}),(0,r.jsxs)("h2",{children:[r.jsx("span",{className:"num",children:"04 —"}),"Les maisons sp\xe9cialis\xe9es : l'expertise comme arme \xe0 double tranchant"]}),r.jsx("p",{children:"Certaines structures se concentrent exclusivement sur un segment pr\xe9cis — estampes et \xe9ditions, photographie d'avant-garde, design d'apr\xe8s-guerre, art contemporain africain. Cette sp\xe9cialisation cr\xe9e deux dynamiques oppos\xe9es."}),r.jsx("p",{children:"La confrontation d'experts : sur les pi\xe8ces phares d'un catalogue sp\xe9cialis\xe9, la comp\xe9tition est f\xe9roce. Les meilleurs sp\xe9cialistes mondiaux du segment seront pr\xe9sents. Les prix refl\xe9teront fid\xe8lement le haut du march\xe9."}),r.jsx("p",{children:"Les opportunit\xe9s en marge : la strat\xe9gie optimale consiste \xe0 chercher les lots situ\xe9s en p\xe9riph\xe9rie de la th\xe9matique principale. Une œuvre d'art moderne \xe9gar\xe9e au milieu d'un catalogue de design d'apr\xe8s-guerre b\xe9n\xe9ficiera souvent d'un d\xe9ficit d'attention de la part des acheteurs pr\xe9sents ce jour-l\xe0."}),(0,r.jsxs)("h2",{children:[r.jsx("span",{className:"num",children:"05 —"}),"Les ventes de succession et collections priv\xe9es : l'art frais"]}),r.jsx("p",{children:"C'est le segment le plus complexe \xe0 monitorer — et historiquement le plus int\xe9ressant pour les collectionneurs les plus avertis. C'est ici que l'on trouve ce que le march\xe9 appelle de l'art frais (fresh to the market) : des œuvres qui n'ont pas chang\xe9 de mains depuis des d\xe9cennies."}),r.jsx("p",{children:"Quand une collection priv\xe9e constitu\xe9e sur plusieurs d\xe9cennies est dispers\xe9e, plusieurs facteurs jouent en votre faveur : Une provenance impeccable. Les œuvres rest\xe9es dans la m\xeame collection familiale pendant 30 ou 40 ans b\xe9n\xe9ficient d'une tra\xe7abilit\xe9 rare — un facteur cl\xe9 pour pr\xe9server la valeur \xe0 long terme. Des estimations conservatrices. Les h\xe9ritiers ou ex\xe9cuteurs testamentaires cherchent souvent une liquidation rapide pour des raisons fiscales ou successorales. Les estimations de d\xe9part sont fr\xe9quemment tr\xe8s attractives, en particulier sur les lots secondaires. Le ph\xe9nom\xe8ne des lots oubli\xe9s. Une collection constitu\xe9e avec passion sur 40 ans peut contenir des œuvres d'artistes dont la cote a consid\xe9rablement \xe9volu\xe9 depuis l'achat initial. Ces lots passent souvent sous le radar des bases de donn\xe9es traditionnelles — et c'est pr\xe9cis\xe9ment l\xe0 que les acheteurs inform\xe9s font leurs meilleures affaires."}),(0,r.jsxs)("div",{className:"nautilus-section",children:[r.jsx("div",{className:"section-label",children:"◆ Ce que Nautilus surveille pour vous"}),r.jsx("h3",{children:"Monitorer ces canaux manuellement est humainement impossible."}),r.jsx("p",{children:"Le volume de donn\xe9es g\xe9n\xe9r\xe9 quotidiennement se compte en dizaines de milliers de lots."}),r.jsx("p",{children:"C'est pr\xe9cis\xe9ment ce que Nautilus r\xe9sout. Notre plateforme agr\xe8ge et analyse en temps r\xe9el les catalogues de centaines de maisons de vente pour identifier les inefficiences de prix avant le d\xe9but des ench\xe8res."}),r.jsx("p",{children:"Pour chaque lot analys\xe9 :"}),(0,r.jsxs)("ul",{children:[r.jsx("li",{children:"Un score de conviction (0–100)"}),r.jsx("li",{children:"Un ench\xe8re maximum calcul\xe9e"}),r.jsx("li",{children:"Une r\xe9f\xe9rence march\xe9 sur 24 mois"})]}),r.jsx("p",{children:"Nautilus identifie les opportunit\xe9s que le march\xe9 n'a pas encore pric\xe9es."}),r.jsx("div",{style:{textAlign:"center",marginTop:"24px"},children:r.jsx("a",{href:"https://get-nautilus.com",style:{display:"inline-block",background:"#2563EB",color:"#ffffff",fontFamily:"'DM Mono', monospace",fontSize:"13px",fontWeight:600,letterSpacing:"0.08em",textDecoration:"none",padding:"14px 32px",borderRadius:"5px"},children:"D\xe9couvrir Nautilus gratuitement →"})}),r.jsx("p",{className:"disclaimer",children:"Cet article est fourni \xe0 titre \xe9ducatif uniquement et ne constitue pas un conseil en investissement."})]}),(0,r.jsxs)("div",{className:"sources",children:[r.jsx("strong",{children:"Sources"}),"Art Basel & UBS Global Art Market Report 2026 \xb7 Bank of America Art Market Report 2026 \xb7 ArtTactic Market Analysis 2025"]})]})]})}},39693:(e,t,s)=>{"use strict";s.r(t),s.d(t,{default:()=>a,metadata:()=>n});var r=s(72051);s(67272);let i=(0,s(45347).createProxy)(String.raw`/Users/camillefroment/Documents/Claude code/artalpha-figma/frontend/components/layout/PlanSync.tsx#PlanSync`),n={title:"ArtAlpha — AI Auction Deal Finder",description:"Detect underpriced auction lots before the gavel falls.",keywords:["auction","art","deals","drouot","invaluable","AI"],openGraph:{title:"ArtAlpha",description:"Intelligence at the gavel.",type:"website"}};function a({children:e}){return(0,r.jsxs)("html",{lang:"fr",children:[(0,r.jsxs)("head",{children:[r.jsx("link",{rel:"preconnect",href:"https://fonts.googleapis.com"}),r.jsx("link",{rel:"preconnect",href:"https://fonts.gstatic.com",crossOrigin:"anonymous"})]}),(0,r.jsxs)("body",{style:{minHeight:"100vh",backgroundColor:"#0a0a0b",color:"#fafafa"},className:"antialiased",children:[r.jsx(i,{}),e]})]})}},67272:()=>{}};var t=require("../../../webpack-runtime.js");t.C(e);var s=e=>t(t.s=e),r=t.X(0,[152],()=>s(6946));module.exports=r})();