import express from 'express';
import fetch from 'node-fetch';

const app = express();
app.use(express.json({ limit: '10b' }));

app.post('/test', (req, res) => {
  res.json({ ok: true });
});

app.use((err, req, res, next) => {
  console.log("Error handler caught:", err.message);
  res.status(err.status || 500).send("Custom Error: " + err.message);
});

app.listen(3001, async () => {
  const resp = await fetch('http://localhost:3001/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"very": "long string that exceeds 10 bytes definitely"}'
  });
  console.log(resp.status);
  console.log(await resp.text());
  process.exit(0);
});
