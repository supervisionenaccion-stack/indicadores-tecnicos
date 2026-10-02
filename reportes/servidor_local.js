// Servidor local solo para mirar las paginas prueba_*.html en http://localhost:8765/
const http=require("http"),fs=require("fs"),path=require("path");
const raiz=path.join(__dirname,"..");
const tipos={".html":"text/html; charset=utf-8",".js":"text/javascript",".css":"text/css",".png":"image/png",".jpg":"image/jpeg",".json":"application/json"};
http.createServer((q,r)=>{const p=path.join(raiz,decodeURIComponent(q.url.split("?")[0]));
 if(!p.startsWith(path.normalize(raiz))||!fs.existsSync(p)||fs.statSync(p).isDirectory()){r.writeHead(404);return r.end("no");}
 r.writeHead(200,{"Content-Type":tipos[path.extname(p)]||"application/octet-stream"});fs.createReadStream(p).pipe(r);}).listen(8765,"127.0.0.1");
