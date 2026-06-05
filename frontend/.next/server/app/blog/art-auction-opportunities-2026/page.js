(()=>{var e={};e.id=369,e.ids=[369],e.modules={72934:e=>{"use strict";e.exports=require("next/dist/client/components/action-async-storage.external.js")},54580:e=>{"use strict";e.exports=require("next/dist/client/components/request-async-storage.external.js")},45869:e=>{"use strict";e.exports=require("next/dist/client/components/static-generation-async-storage.external.js")},20399:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},27790:e=>{"use strict";e.exports=require("assert")},84770:e=>{"use strict";e.exports=require("crypto")},17702:e=>{"use strict";e.exports=require("events")},92048:e=>{"use strict";e.exports=require("fs")},32615:e=>{"use strict";e.exports=require("http")},32694:e=>{"use strict";e.exports=require("http2")},35240:e=>{"use strict";e.exports=require("https")},19801:e=>{"use strict";e.exports=require("os")},55315:e=>{"use strict";e.exports=require("path")},76162:e=>{"use strict";e.exports=require("stream")},74175:e=>{"use strict";e.exports=require("tty")},17360:e=>{"use strict";e.exports=require("url")},21764:e=>{"use strict";e.exports=require("util")},71568:e=>{"use strict";e.exports=require("zlib")},66838:(e,t,i)=>{"use strict";i.r(t),i.d(t,{GlobalError:()=>s.a,__next_app__:()=>u,originalPathname:()=>d,pages:()=>p,routeModule:()=>h,tree:()=>c}),i(83055),i(39693),i(90996);var o=i(30170),r=i(45002),a=i(83876),s=i.n(a),n=i(66299),l={};for(let e in n)0>["default","tree","pages","GlobalError","originalPathname","__next_app__","routeModule"].indexOf(e)&&(l[e]=()=>n[e]);i.d(t,l);let c=["",{children:["blog",{children:["art-auction-opportunities-2026",{children:["__PAGE__",{},{page:[()=>Promise.resolve().then(i.bind(i,83055)),"/Users/camillefroment/Documents/Claude code/artalpha-figma/frontend/app/blog/art-auction-opportunities-2026/page.tsx"]}]},{}]},{}]},{layout:[()=>Promise.resolve().then(i.bind(i,39693)),"/Users/camillefroment/Documents/Claude code/artalpha-figma/frontend/app/layout.tsx"],"not-found":[()=>Promise.resolve().then(i.t.bind(i,90996,23)),"next/dist/client/components/not-found-error"]}],p=["/Users/camillefroment/Documents/Claude code/artalpha-figma/frontend/app/blog/art-auction-opportunities-2026/page.tsx"],d="/blog/art-auction-opportunities-2026/page",u={require:i,loadChunk:()=>Promise.resolve()},h=new o.AppPageRouteModule({definition:{kind:r.x.APP_PAGE,page:"/blog/art-auction-opportunities-2026/page",pathname:"/blog/art-auction-opportunities-2026",bundlePath:"",filename:"",appPaths:[]},userland:{loaderTree:c}})},52880:(e,t,i)=>{Promise.resolve().then(i.bind(i,18473))},77824:(e,t,i)=>{Promise.resolve().then(i.t.bind(i,63642,23)),Promise.resolve().then(i.t.bind(i,87586,23)),Promise.resolve().then(i.t.bind(i,47838,23)),Promise.resolve().then(i.t.bind(i,58057,23)),Promise.resolve().then(i.t.bind(i,77741,23)),Promise.resolve().then(i.t.bind(i,13118,23))},35303:()=>{},18473:(e,t,i)=>{"use strict";i.d(t,{PlanSync:()=>r}),i(28964);var o=i(72697);function r(){let{isAuthenticated:e,setPlan:t}=(0,o.t)();return null}i(68920)},68920:(e,t,i)=>{"use strict";i.d(t,{Ol:()=>l,YE:()=>n,a2:()=>p,g6:()=>s,hi:()=>a,iJ:()=>d,nJ:()=>u,zw:()=>c});var o=i(83128),r=i(72266);let a=o.Z.create({baseURL:"http://localhost:8000",timeout:15e3});a.interceptors.request.use(e=>{let t=r.Z.get("hono_token")||!1;return t&&(e.headers.Authorization=`Bearer ${t}`),e}),a.interceptors.response.use(e=>e,e=>(e.response?.status===401&&r.Z.remove("hono_token"),Promise.reject(e)));let s={list:e=>a.get("/api/lots",{params:e}),get:e=>a.get(`/api/lots/${e}`),topDeals:(e=10)=>a.get("/api/lots/top-deals",{params:{limit:e}}),hotDeals:(e=30,t=70)=>a.get("/api/lots/hot-deals",{params:{limit:e,min_score:t}}),stats:()=>a.get("/api/lots/stats"),categories:()=>a.get("/api/lots/categories"),trending:e=>a.get("/api/lots/trending",{params:e}),missed:e=>a.get("/api/lots/missed",{params:e}),comparables:e=>a.get(`/api/lots/${e}/comparables`),similar:e=>a.get(`/api/lots/${e}/similar`)},n={ids:()=>a.get("/api/wishlist/ids"),list:()=>a.get("/api/wishlist"),add:e=>a.post(`/api/wishlist/${e}`),remove:e=>a.delete(`/api/wishlist/${e}`)},l={list:e=>a.get("/api/alerts",{params:e}),delete:e=>a.delete(`/api/alerts/${e}`)},c={get:()=>a.get("/api/preferences"),update:e=>a.patch("/api/preferences",e)},p={list:e=>a.get("/api/artists",{params:e}),get:e=>a.get(`/api/artists/${e}`),oracle:e=>a.get(`/api/artists/${e}/oracle`)},d={login:(e,t)=>a.post("/api/auth/login",{email:e,password:t}),register:(e,t,i)=>a.post("/api/auth/register",{email:e,password:t,full_name:i}),me:()=>a.get("/api/auth/me")},u={list:()=>a.get("/api/portfolio"),get:e=>a.get(`/api/portfolio/${e}`),add:e=>a.post("/api/portfolio",e),update:(e,t)=>a.patch(`/api/portfolio/${e}`,t),remove:e=>a.delete(`/api/portfolio/${e}`)}},72697:(e,t,i)=>{"use strict";i.d(t,{t:()=>s});var o=i(99713),r=i(92377),a=i(72266);let s=(0,o.U)()((0,r.tJ)(e=>({user:null,token:null,plan:"free",isAuthenticated:!1,setAuth:(t,i)=>{a.Z.set("hono_token",i,{expires:7,sameSite:"strict"}),e({user:t,token:i,isAuthenticated:!0})},setPlan:t=>e({plan:t}),logout:()=>{a.Z.remove("hono_token"),e({user:null,token:null,plan:"free",isAuthenticated:!1})}}),{name:"hono-auth",partialize:e=>({user:e.user,token:e.token,plan:e.plan,isAuthenticated:e.isAuthenticated})}))},83055:(e,t,i)=>{"use strict";i.r(t),i.d(t,{default:()=>s,metadata:()=>r});var o=i(72051);let r={title:"The Best Art Auction Opportunities in 2026 \xb7 Nautilus",description:"Where and how to find the best opportunities in the art auction market in 2026. A complete guide to sales worth tracking.",alternates:{canonical:"https://get-nautilus.com/blog/art-auction-opportunities-2026",languages:{fr:"/blog/opportunites-encheres-2026"}},openGraph:{title:"The Best Art Auction Opportunities in 2026",description:"Where and how to find the best opportunities in the art auction market in 2026.",type:"article",locale:"en_US",url:"https://get-nautilus.com/blog/art-auction-opportunities-2026",siteName:"Nautilus"}},a=`
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
`;function s(){return(0,o.jsxs)(o.Fragment,{children:[o.jsx("style",{dangerouslySetInnerHTML:{__html:a}}),(0,o.jsxs)("article",{className:"article-wrap",children:[o.jsx("h1",{children:"The Best Art Auction Opportunities in 2026: A Guide to Sales Worth Tracking"}),o.jsx("p",{className:"chapeau",children:"Everyone is familiar with the major auction rooms of London, New York, and Paris. Yet the collectors who secure the most compelling acquisitions are not those tracking the most publicised sales. They are the ones who know exactly where to look — and why certain auction formats structurally generate more value than others."}),o.jsx("p",{children:"The global art market commands over 60 billion dollars annually, but the vast majority of price inefficiencies occur far from the headlines. More than half of all lots sold at auction worldwide hammer down below the 5,000 dollar threshold. Within this vast ocean of data lies the true ground for market opportunity."}),o.jsx("p",{children:"This is the framework the traditional market rarely publishes."}),(0,o.jsxs)("h2",{children:[o.jsx("span",{className:"num",children:"01 —"}),"Major International Auction Houses: The Benchmark, Not the Playground"]}),o.jsx("p",{children:"The major international houses set the benchmark for the global market. They provide unmatched transparency, elite expertise, rigorous cataloguing, and solid guarantees — offering a highly secure environment for any buyer. However, this global visibility is precisely why their flagship sales are rarely the place to find pricing asymmetries."}),o.jsx("p",{children:"Their prestigious evening sales are broadcast worldwide in real time. Buyers from London, New York, Hong Kong, and Paris compete simultaneously for the exact same lot. This hyper-centralised competition mechanically drives prices toward — or beyond — their fair market value."}),o.jsx("p",{children:"Where to look instead: focus on their Day Sales and Online-Only sessions. Less publicised, routinely bypassed by institutional buyers, these frequently present significant price discrepancies for comparable works. A lot that did not meet the threshold of an Evening Sale often shifts to a Day Sale: same artist, same quality, dramatically reduced audience."}),(0,o.jsxs)("h2",{children:[o.jsx("span",{className:"num",children:"02 —"}),"Regional European Auction Houses: The True Value Ground"]}),o.jsx("p",{children:"This is where the most significant market asymmetries reside for an informed buyer."}),o.jsx("p",{children:"Regional houses — whether located in Scandinavia, the French provinces, Central Europe, or the Benelux countries — primarily operate within local buying pools. An artist whose market is firmly established in London or Paris can be heavily undervalued in a regional sale, simply because the local audience lacks deep secondary-market familiarity with their work."}),o.jsx("p",{children:"The dynamic is straightforward: limited international exposure equals fewer live competitors, resulting in structurally lower entry prices for equivalent quality."}),o.jsx("p",{children:"What to target: thematic sales (prints, European modern art, design) hosted by specialized regional firms. End-of-season windows: sales organized in mid-August or early January, quiet periods when professionals switch off their alerts. Artworks by internationally recognised artists that have gone astray in local estate inventories."}),(0,o.jsxs)("div",{className:"note",children:[o.jsx("strong",{children:"A note of caution"}),"The precision of condition reporting can vary widely. Always request detailed photography of the reverse and, for significant purchases, a written condition report before committing capital."]}),(0,o.jsxs)("h2",{children:[o.jsx("span",{className:"num",children:"03 —"}),"Online Aggregators: Volume, Noise, and Diligence"]}),o.jsx("p",{children:"Digital platforms that aggregate hundreds of regional auction houses have fundamentally democratized access to the secondary market. From your desk, you can monitor concurrent sales in Stockholm, Frankfurt, and Lisbon simultaneously. The benefit is obvious: massive exposure to opportunities that would otherwise remain invisible."}),o.jsx("p",{children:"Structural pitfalls to account for: Hidden platform fees. Most aggregators add their own online bidding fee — typically 3% to 5% — on top of the auction house buyer's premium (20% to 30%). The droit de suite. In Europe, do not forget to factor in the artist's resale right — a royalty due to the heirs of artists deceased less than 70 years ago, calculated on a degressive scale from 4% to 0.25% of the hammer price. A frequently overlooked cost that can add several hundred euros to an intermediate purchase. Data noise. Without algorithmic filtering tools, you can easily spend hours sifting through hundreds of inconsequential lots before uncovering a genuinely interesting piece."}),o.jsx("p",{children:"The right approach: use these platforms for discovery. Bid directly through the auction house's own website whenever possible to avoid additional aggregator fees."}),(0,o.jsxs)("h2",{children:[o.jsx("span",{className:"num",children:"04 —"}),"Specialized Auction Houses: Expertise as a Double-Edged Sword"]}),o.jsx("p",{children:"Certain boutique firms focus exclusively on specific niches — prints and editions, avant-garde photography, post-war design, contemporary African art. This hyper-specialization creates two contrasting dynamics."}),o.jsx("p",{children:"The expert arena: for the star lots of a specialized catalogue, competition is cutthroat. Top global specialists will be present. Final prices will accurately reflect the absolute top of the market."}),o.jsx("p",{children:"Out-of-category opportunities: the optimal strategy is to hunt for lots that sit on the periphery of the house's primary specialization. A modern painting tucked away inside a specialized post-war design catalogue will often suffer from a deficit of attention from the design-focused buyers registered for that specific sale."}),(0,o.jsxs)("h2",{children:[o.jsx("span",{className:"num",children:"05 —"}),"Estate Sales and Private Collections: Fresh-to-Market Art"]}),o.jsx("p",{children:"This is the most complex segment to monitor consistently — and historically the most rewarding for informed collectors. This is where the market finds what it calls fresh-to-the-market art: works that have not changed hands for decades."}),o.jsx("p",{children:"When a private collection built over several decades is liquidated, multiple factors align in your favour: Impeccable provenance. Artworks that have remained within the same family collection for 30 or 40 years boast excellent, unbroken traceability — a vital factor for preserving long-term value. Motivated valuation. Heirs or estate executors are often seeking swift liquidation for probate or tax purposes. Starting estimates are frequently highly conservative, particularly for secondary lots. The forgotten lot phenomenon. A collection built with genuine passion decades ago often contains works acquired before an artist's market matured. These pieces may not have been documented on the open market for half a century, frequently slipping beneath the radar of standard indexing databases — and this is precisely where informed buyers make their best acquisitions."}),(0,o.jsxs)("div",{className:"nautilus-section",children:[o.jsx("div",{className:"section-label",children:"◆ How Nautilus Streamlines the Market"}),o.jsx("h3",{children:"Manually monitoring all of these channels is an impossible human task."}),o.jsx("p",{children:"The volume of data generated daily spans tens of thousands of lots."}),o.jsx("p",{children:"This is exactly what Nautilus resolves. Our platform aggregates and analyzes real-time auction data from hundreds of houses worldwide to identify structural price inefficiencies before the bidding begins."}),o.jsx("p",{children:"For every analyzed lot:"}),(0,o.jsxs)("ul",{children:[o.jsx("li",{children:"A Conviction Score (0–100)"}),o.jsx("li",{children:"A calculated maximum bid"}),o.jsx("li",{children:"An objective Market Reference over 24 months"})]}),o.jsx("p",{children:"Nautilus identifies the opportunities the market has not yet priced in."}),o.jsx("div",{style:{textAlign:"center",marginTop:"24px"},children:o.jsx("a",{href:"https://get-nautilus.com",style:{display:"inline-block",background:"#2563EB",color:"#ffffff",fontFamily:"'DM Mono', monospace",fontSize:"13px",fontWeight:600,letterSpacing:"0.08em",textDecoration:"none",padding:"14px 32px",borderRadius:"5px"},children:"Discover Nautilus for free →"})}),o.jsx("p",{className:"disclaimer",children:"This article is provided for educational purposes only and does not constitute financial investment advice."})]}),(0,o.jsxs)("div",{className:"sources",children:[o.jsx("strong",{children:"Sources"}),"Art Basel & UBS Global Art Market Report 2026 \xb7 Bank of America Art Market Report 2026 \xb7 ArtTactic Market Analysis 2025"]})]})]})}},39693:(e,t,i)=>{"use strict";i.r(t),i.d(t,{default:()=>s,metadata:()=>a});var o=i(72051);i(67272);let r=(0,i(45347).createProxy)(String.raw`/Users/camillefroment/Documents/Claude code/artalpha-figma/frontend/components/layout/PlanSync.tsx#PlanSync`),a={title:"ArtAlpha — AI Auction Deal Finder",description:"Detect underpriced auction lots before the gavel falls.",keywords:["auction","art","deals","drouot","invaluable","AI"],openGraph:{title:"ArtAlpha",description:"Intelligence at the gavel.",type:"website"}};function s({children:e}){return(0,o.jsxs)("html",{lang:"fr",children:[(0,o.jsxs)("head",{children:[o.jsx("link",{rel:"preconnect",href:"https://fonts.googleapis.com"}),o.jsx("link",{rel:"preconnect",href:"https://fonts.gstatic.com",crossOrigin:"anonymous"})]}),(0,o.jsxs)("body",{style:{minHeight:"100vh",backgroundColor:"#0a0a0b",color:"#fafafa"},className:"antialiased",children:[o.jsx(r,{}),e]})]})}},67272:()=>{}};var t=require("../../../webpack-runtime.js");t.C(e);var i=e=>t(t.s=e),o=t.X(0,[152],()=>i(66838));module.exports=o})();