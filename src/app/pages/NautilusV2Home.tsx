import { Link } from 'react-router';

const cards = [
  {
    eyebrow: '01 · VOTRE UNIVERS',
    title: 'L’art qui vous ressemble',
    body: 'Définissez vos styles, vos périodes et votre budget. Découvrez votre profil artistique, sans créer de compte.',
    to: '/decouvrir/mon-profil-artistique',
    action: 'Créer mon profil',
  },
  {
    eyebrow: '02 · ACHETER EN CONNAISSANCE DE CAUSE',
    title: 'Combien coûte vraiment une enchère ?',
    body: 'Estimez le montant total à prévoir : adjudication, frais acheteur, taxes, transport et assurance.',
    to: '/outils/calculateur-encheres',
    action: 'Calculer mes frais',
  },
];
export default function NautilusV2Home() {
  return <main style={{minHeight:'100vh',background:'#F7F5F0',color:'#1A2A44',fontFamily:'Inter,Arial,sans-serif'}}>
    <header style={{padding:'24px clamp(20px,6vw,80px)',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid #E1DED7'}}>
      <Link to="/" style={{fontFamily:'Georgia,serif',fontSize:24,color:'#1A2A44',textDecoration:'none'}}>Nautilus</Link>
      <span style={{fontSize:12,letterSpacing:2}}>ATELIER · VERSION 2</span>
    </header>
    <div style={{maxWidth:1080,margin:'0 auto',padding:'clamp(56px,9vw,110px) 20px'}}>
      <p style={{letterSpacing:3,fontSize:12}}>LE COMPAGNON DES AMATEURS D’ART</p>
      <h1 style={{fontFamily:'Georgia,serif',fontSize:'clamp(38px,6vw,72px)',fontWeight:400,lineHeight:1.1,maxWidth:850,margin:'22px 0'}}>L’art de choisir.<br/>Le plaisir de découvrir.</h1>
      <p style={{fontSize:17,lineHeight:1.8,maxWidth:650,color:'#4C5868'}}>Explorez vos goûts et préparez vos achats aux enchères avec des outils simples, clairs et transparents.</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(270px,1fr))',gap:20,marginTop:54}}>
        {cards.map(card=><article key={card.to} style={{background:'#fff',border:'1px solid #E6E2DB',borderRadius:14,padding:'clamp(24px,4vw,42px)',display:'flex',flexDirection:'column',alignItems:'start',minHeight:300}}>
          <p style={{fontSize:11,letterSpacing:2}}>{card.eyebrow}</p>
          <h2 style={{fontFamily:'Georgia,serif',fontWeight:400,fontSize:29,lineHeight:1.25,margin:'14px 0'}}>{card.title}</h2>
          <p style={{fontSize:14,lineHeight:1.75,color:'#4C5868',flex:1}}>{card.body}</p>
          <Link to={card.to} style={{display:'inline-block',background:'#1A2A44',color:'#fff',textDecoration:'none',padding:'13px 20px',borderRadius:7,marginTop:18,fontSize:14}}>{card.action} →</Link>
        </article>)}
      </div>
      <section style={{marginTop:64,borderTop:'1px solid #D9D5CC',paddingTop:28}}>
        <h2 style={{fontFamily:'Georgia,serif',fontSize:25,fontWeight:400}}>Et les œuvres à découvrir ?</h2>
        <p style={{fontSize:14,lineHeight:1.8,maxWidth:750}}>Le catalogue personnalisé est en préparation. Nous n’affichons pas de lots, de photographies ou de résultats de ventes sans autorisation de réutilisation vérifiée. Les enchères se dérouleront exclusivement sur les sites officiels des maisons de ventes partenaires.</p>
      </section>
      <p style={{fontSize:12,color:'#596473',marginTop:48}}>Version de démonstration · Aucun compte, paiement ou service d’analyse externe requis pour ces deux outils.</p>
    </div>
  </main>;
}
