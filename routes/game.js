var express = require('express');
var router = express.Router();

router.get('/', (req, res, next) => {
  const host = process.env.HOST || 'http://localhost:8000';
  res.render('game', { title: 'オンラインゲーム', host: host });
});

module.exports = router;
