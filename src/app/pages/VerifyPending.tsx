export default function VerifyPending() {
  return (
    <div style={{height:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'#FAFAF8'}}>
      <div style={{textAlign:'center',maxWidth:400,padding:'0 24px'}}>
        <div style={{color:'#C6A85A',fontSize:11,letterSpacing:'0.2em',textTransform:'uppercase',marginBottom:16}}>CHECK YOUR INBOX</div>
        <h1 style={{color:'#1A2A44',fontFamily:'Georgia,serif',fontSize:24,fontWeight:'normal',marginBottom:12}}>
          Verify your email to continue.
        </h1>
        <p style={{color:'#888',fontSize:14,lineHeight:1.7,marginBottom:24}}>
          We sent a verification link to your email. Click it to access Nautilus.
        </p>
        <p style={{color:'#aaa',fontSize:12}}>Didn't receive it? Check your spam folder.</p>
      </div>
    </div>
  );
}
