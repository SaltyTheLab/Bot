import express from 'express';
const app = express();
const PORT = 3000;
 var commandcount = 0;
let commandLog = [];

app.use(express.static('public'));

app.get('/commands', (req, res) => {
    res.json(commandLog);
});

app.post('log',express.json(), (req, res) => {
    commandLog.push(req.body);
    res.sendStatus(200);
    commandcount++;
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));