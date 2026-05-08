const _=new TextEncoder,a=n=>_.encode(n).length,F=n=>String(n??"").replace(/\\/g,"\\\\").replace(/\(/g,"\\(").replace(/\)/g,"\\)").replace(/\r/g," ").replace(/\n/g," "),h=n=>{const o=Math.max(1,Math.floor(50)),t=[];for(let e=0;e<n.length;e+=o)t.push(n.slice(e,e+o));return t.length===0&&t.push([""]),t},b=n=>{const o=["BT","/F1 11 Tf","1 0 0 1 50 750 Tm"];return n.forEach((t,e)=>{e>0&&o.push("0 -14 Td"),o.push(`(${F(t)}) Tj`)}),o.push("ET"),o.join(`
`)},m=n=>{const o=h(n),t=4+o.length*2,e=new Array(t+1).fill("");e[1]="<< /Type /Catalog /Pages 2 0 R >>",e[3]="<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";const r=[];o.forEach((c,l)=>{const p=4+l*2,i=5+l*2,f=b(c);r.push(`${p} 0 R`),e[p]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${i} 0 R >>`,e[i]=`<< /Length ${a(f)} >>
stream
${f}
endstream`}),e[2]=`<< /Type /Pages /Count ${o.length} /Kids [${r.join(" ")}] >>`;let s=`%PDF-1.4
`;const d=new Array(t+1).fill(0);for(let c=1;c<=t;c+=1)d[c]=a(s),s+=`${c} 0 obj
${e[c]}
endobj
`;const T=a(s);s+=`xref
0 ${t+1}
`,s+=`0000000000 65535 f 
`;for(let c=1;c<=t;c+=1)s+=`${String(d[c]).padStart(10,"0")} 00000 n 
`;return s+=`trailer
<< /Size ${t+1} /Root 1 0 R >>
`,s+=`startxref
${T}
%%EOF`,new Blob([s],{type:"application/pdf"})},u=(n,o="document.pdf")=>{const e=String(n||"").trim().replace(/[<>:"/\\|?*]+/g,"-").replace(/\s+/g,"-").toLowerCase();return e?e.endsWith(".pdf")?e:`${e}.pdf`:o},g=(n,o)=>{const t=URL.createObjectURL(n),e=document.createElement("a");e.href=t,e.download=u(o),e.style.display="none",document.body.appendChild(e),e.click(),e.remove(),URL.revokeObjectURL(t)},P=n=>String(n||"").split(/\r?\n/),E=({title:n="Document",lines:o=[],fileName:t="document.pdf"})=>{const e=[...P(n),"",...o.flatMap(s=>P(s))],r=m(e);g(r,t)},I=async(n,o="document.pdf")=>{if(!n)throw new Error("Missing download URL.");const t=await fetch(n);if(!t.ok)throw new Error(`Unable to download file (${t.status}).`);const e=await t.blob();g(e,o)};export{I as a,E as d};
