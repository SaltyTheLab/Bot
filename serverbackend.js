import express from 'express';
import fs from 'fs';
const fs = require('fs');
const app = express();
const PORT = 3000;
let commandLog = [];

app.use(express.static('public'));

app.get('/commands', (req, res) => {
    res.json(commandLog);
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));