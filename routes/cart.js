const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db/database.sqlite');

// 1. 장바구니에 담기 (새로운 DB 구조)
router.post('/add', (req, res) => {
    const user = req.session.user;
    const productId = req.body.productId;

    if (!user) {
        return res.send('<script>alert("장바구니를 이용하시려면 로그인이 필요합니다."); location.href="/user/login";</script>');
    }

    const username = user.username;

    // 이미 장바구니에 똑같은 상품을 담았었는지 확인
    db.get('SELECT * FROM carts WHERE username = ? AND product_id = ?', [username, productId], (err, row) => {
        if (err) return res.status(500).send('장바구니 담기 오류');

        if (row) {
            // 이미 담겨있다면 수량 +1
            db.run('UPDATE carts SET quantity = quantity + 1 WHERE id = ?', [row.id], (uErr) => {
                if (uErr) return res.send('수량 변경 실패');
                res.send('<script>alert("장바구니에 상품 수량이 추가되었습니다!"); history.back();</script>');
            });
        } else {
            // 처음 담는 상품이라면 1개 새로 추가
            db.run('INSERT INTO carts (username, product_id, quantity) VALUES (?, ?, 1)', [username, productId], (iErr) => {
                if (iErr) return res.send('장바구니 추가 실패');
                res.send('<script>alert("장바구니에 상품이 정상적으로 담겼습니다!"); history.back();</script>');
            });
        }
    });
});

// 📋 2. 장바구니 목록 조회 (carts 테이블과 제품 테이블 조인)
router.get('/', (req, res) => {
    const user = req.session.user;
    if (!user) return res.redirect('/user/login');

    const username = user.username;

    // carts 테이블과 products 테이블을 엮어서 상품 정보와 수량을 같이 긁어옵니다.
    const query = `
    SELECT p.id, p.name, p.price, p.description, c.quantity
    FROM carts c
    JOIN products p ON c.product_id = p.id
    WHERE c.username = ?`;

    db.all(query, [username], (err, rows) => {
        if (err) return res.status(500).send('장바구니 조회 실패');
        // views/cart.ejs 템플릿에 데이터 전달
        res.render('cart', { cartItems: rows, user });
    });
});

// ➕➖ 3. 장바구니 수량 조절 (플러스/마이너스 버튼)
router.post('/update', (req, res) => {
    if (!req.session.user) return res.redirect('/user/login');

    const username = req.session.user.username;
    const productId = req.body.productId;
    const action = req.body.action;

    db.get(`SELECT quantity FROM carts WHERE username = ? AND product_id = ?`, [username, productId], (err, row) => {
        if (err || !row) return res.status(500).send("❌ 조회 실패");

        let newQuantity = row.quantity;
        if (action === 'increase') {
            newQuantity += 1;
        } else if (action === 'decrease') {
            newQuantity -= 1;
        }

        if (newQuantity <= 0) {
            // 수량이 0 이하가 되면 품목 삭제
            db.run(`DELETE FROM carts WHERE username = ? AND product_id = ?`, [username, productId], (err) => {
                return res.redirect('/cart');
            });
        } else {
            // 수량 업데이트
            db.run(`UPDATE carts SET quantity = ? WHERE username = ? AND product_id = ?`, [newQuantity, username, productId], (err) => {
                return res.redirect('/cart');
            });
        }
    });
});

// 장바구니 항목 개별 삭제
router.post('/delete', (req, res) => {
    const user = req.session.user;
    const { productId } = req.body;

    if (!user) return res.redirect('/user/login');

    db.run(`DELETE FROM carts WHERE username = ? AND product_id = ?`, [user.username, productId], (err) => {
        if (err) return res.status(500).send('삭제 실패');
        res.redirect('/cart');
    });
});

module.exports = router;

