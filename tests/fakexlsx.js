window.XLSX={utils:{book_new:()=>({SheetNames:[],Sheets:{}}),aoa_to_sheet:a=>({aoa:JSON.parse(JSON.stringify(a))}),book_append_sheet:(wb,ws,n)=>{wb.SheetNames.push(n);wb.Sheets[n]=ws},
 sheet_to_json:(ws,o)=>ws.aoa.map(r=>r.map(v=>v===''?null:v))},writeFile:(wb,f)=>{window.__wb=wb;window.__fname=f},read:()=>window.__wb};
