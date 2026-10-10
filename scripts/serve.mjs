import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root=resolve('docs'); const port=Number(process.env.PORT || 4173);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{
  try {
    let path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    // Mirror a project Pages site so relative-path regressions appear locally.
    if(path==='/') { res.writeHead(302,{Location:'/RiskyUser101/'}); res.end(); return; }
    if(!path.startsWith('/RiskyUser101/')) throw new Error('Not found');
    let file=resolve(root,`.${path.slice('/RiskyUser101'.length)}`);
    if(file!==root&&!file.startsWith(root+sep)) throw new Error('Not found');
    if((await stat(file)).isDirectory()) file=resolve(file,'index.html');
    const body=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)] || 'text/plain','Cache-Control':'no-store'});res.end(body);
  }catch {res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');}
});
server.listen(port,'127.0.0.1',()=>process.stdout.write(`Local: http://127.0.0.1:${port}/RiskyUser101/\n`));
