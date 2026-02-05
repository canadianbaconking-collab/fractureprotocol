import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const port = 4173;

const mime = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript"
};

http.createServer((req, res) => {
  const filePath =
    req.url === "/"
      ? path.join(__dirname, "index.html")
      : path.join(__dirname, req.url.split("?")[0]);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": mime[path.extname(filePath)] || "text/plain"
    });
    res.end(data);
  });
}).listen(port, () =>
  console.log(`Fracture Protocol running at http://localhost:${port}`)
);
