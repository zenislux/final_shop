/*
var express = require('express');
var router = express.Router();

/* GET home page. */
/*
router.get('/', function(req, res, next) {
  res.render('index', { title: '내 쇼핑몰' });
});

module.exports = router;
*/
const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db/database.sqlite');

router.get('/', (req, res) => {
  // 💡 조건(WHERE, ORDER BY)을 싹 빼고 products 테이블의 모든 상품을 가져옵니다.
  db.all('SELECT * FROM products', [], (err, featuredProducts) => {
    if (err) {
      console.error('❌ 메인 상품 로드 에러:', err.message); // 터미널에 진짜 에러도 찍어줍니다.
      return res.status(500).send('추천 상품 불러오기 실패: ' + err.message);
    }

    // 정상적으로 가져온 상품들을 메인 화면(index.ejs)으로 던져줍니다.
    res.render('index', {
      title: '내 쇼핑몰',
      featuredProducts: featuredProducts, // 사과, 바나나가 이 배열에 담겨서 갑니다.
      user: req.session.user
    });
  });
});

// 상품 상세 페이지 조회 (주소 형식: /product/1)
router.get('/product/:id', (req, res) => {
  const productId = req.params.id;

  // DB에서 해당 ID를 가진 상품 하나 추출
  db.get('SELECT * FROM products WHERE id = ?', [productId], (err, product) => {
    if (err || !product) {
      return res.send('<script>alert("존재하지 않는 상품입니다."); location.href="/";</script>');
    }

    // 상세 페이지 화면(product_detail.ejs)으로 상품 정보와 세션 유저 정보를 보냅니다.
    res.render('products_detail', {
      product: product,
      user: req.session.user || null
    });
  });
});

module.exports = router;

