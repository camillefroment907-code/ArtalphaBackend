import { useMemo, useState } from 'react';
import { calculateAuctionCost } from '../../lib/auctionCostV2';

export default function AuctionCostCalculatorV2() {
  const [hammer, setHammer] = useState('1000');
  const [premium, setPremium] = useState('');
  const [vat, setVat] = useState('');
  const [taxes, setTaxes] = useState('0');
  const [shipping, setShipping] = useState('0');
  const [other, setOther] = useState('0');
  const result = useMemo(() => {
    try {
      const values = [hammer, premium, vat, taxes, shipping, other];
      if (values.some(v => v.trim() === '')) return null;
      return calculateAuctionCost({
        hammerPrice: Number(hammer), buyerPremiumPercent: Number(premium),
        vatOnPremiumPercent: Number(vat), additionalTaxes: Number(taxes),
        shippingAndInsurance: Number(shipping), otherFees: Number(other),
      });
    } catch { return null; }
  }, [hammer, premium, vat, taxes, shipping, other]);
  const euro = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);
  const fields = [
    ['Prix au marteau (€)', hammer, setHammer],
    ['Frais acheteur (%)', premium, setPremium],
    ['TVA sur frais acheteur (%)', vat, setVat],
    ['Autres taxes (€)', taxes, setTaxes],
    ['Transport et assurance (€)', shipping, setShipping],
    ['Autres frais (€)', other, setOther],
  ] as const;
  return (
    <main style={{minHeight:'100vh',background:'#F7F5F0',color:'#1A2A44',padding:'64px 20px',fontFamily:'Inter,Arial,sans-serif'}}>
      <div style={{maxWidth:840,margin:'0 auto'}}>
        <a href="/v2" style={{color:'#1A2A44',textDecoration:'none',fontSize:13}}>← Nautilus</a>
        <p style={{letterSpacing:3,fontSize:12,marginTop:44}}>LES OUTILS NAUTILUS</p>
        <h1 style={{fontFamily:'Georgia,serif',fontSize:'clamp(32px,5vw,52px)',fontWeight:400}}>Le vrai coût d'une enchère</h1>
        <p style={{lineHeight:1.7,maxWidth:650}}>Le prix au marteau n'est pas le montant final. Indiquez les frais figurant dans les conditions de vente de la maison de ventes pour obtenir une estimation transparente.</p>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))',gap:28,marginTop:40}}>
          <section aria-label="Paramètres" style={{display:'grid',gap:16}}>
            {fields.map(([label,value,setValue])=><label key={label} style={{display:'grid',gap:6,fontSize:13,fontWeight:600}}>
              {label}
              <input type="number" min="0" step="0.01" value={value} onChange={e=>setValue(e.target.value)}
                style={{padding:13,border:'1px solid #CBD0D5',borderRadius:8,fontSize:16,background:'#fff',color:'#1A2A44'}}/>
            </label>)}
          </section>
          <section aria-label="Résultat" aria-live="polite" style={{background:'#fff',borderRadius:14,padding:26,alignSelf:'start',boxShadow:'0 6px 30px #1A2A4410'}}>
            <p style={{fontSize:12,letterSpacing:2}}>COÛT TOTAL ESTIMÉ</p>
            <div style={{fontFamily:'Georgia,serif',fontSize:38,margin:'18px 0 26px'}}>{result?euro(result.total):'—'}</div>
            {result ? [
              ['Prix au marteau',result.hammerPrice],['Frais acheteur',result.buyerPremium],
              ['TVA sur les frais',result.vatOnPremium],['Autres taxes',result.additionalTaxes],
              ['Transport et assurance',result.shippingAndInsurance],['Autres frais',result.otherFees]
            ].map(([label,value])=><div key={String(label)} style={{display:'flex',justifyContent:'space-between',gap:12,padding:'11px 0',borderTop:'1px solid #E9E8E3',fontSize:13}}>
              <span>{label}</span><strong>{euro(Number(value))}</strong>
            </div>) : <p role="alert">Saisissez des nombres valides et positifs.</p>}
          </section>
        </div>
        <p style={{marginTop:32,fontSize:12,lineHeight:1.7,color:'#57606C'}}>Simulation indicative, non contractuelle. Les frais et taxes applicables varient selon la maison de ventes, le lot, le lieu, le statut de l'acheteur et les modalités de livraison. Vérifiez toujours les conditions officielles avant d'enchérir. Aucun taux de commission ou de TVA n’est prérempli : renseignez ceux applicables à votre vente. Aucun compte ni connexion au backend n'est nécessaire pour ce calcul.</p>
      </div>
    </main>
  );
}
