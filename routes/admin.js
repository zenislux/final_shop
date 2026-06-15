const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db/database.sqlite');

// [미들웨어] 관리자가 아니면 튕겨내는 차단막
function isAdmin(req, res, next) {
    const user = req.session.user;
    if (user && user.is_admin === 1) {
        return next(); // 관리자가 맞으면 다음 단계로 통과!
    }
    // 관리자가 아니면 경고창 띄우고 메인으로 튕겨내기
    res.send('<script>alert("접근 권한이 없습니다. 관리자만 접근 가능합니다."); location.href="/";</script>');
}

// 1. 관리자 대시보드 - 전체 주문 내역 조회 (GET /admin)
router.get('/', isAdmin, (req, res) => {
    // 쇼핑몰에 들어온 모든 주문을 최신순으로 긁어옵니다.
    const orderQuery = `SELECT * FROM orders ORDER BY created_at DESC`;

    db.all(orderQuery, [], (err, orders) => {
        if (err) return res.status(500).send('주문 데이터 조회 실패');

        // 각 주문에 어떤 과일들이 들어있는지 상세 품목도 같이 긁어옵니다.
        const itemQuery = `
            SELECT oi.*, p.name 
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
        `;

        db.all(itemQuery, [], (itemErr, orderItems) => {
            if (itemErr) return res.status(500).send('주문 상세 조회 실패');

            // admin_dashboard.ejs 화면으로 모든 주문 데이터를 쏴줍니다.
            res.render('admin_dashboard', {
                user: req.session.user,
                orders: orders,
                orderItems: orderItems
            });
        });
    });
});

// 2. 배송 상태 변경 처리 (POST /admin/order/status)
router.post('/order/status', isAdmin, (req, res) => {
    const { orderId, status } = req.body;

    // 관리자가 선택한 상태(배송중, 배송완료 등)로 주문 테이블을 업데이트합니다.
    db.run('UPDATE orders SET status = ? WHERE id = ?', [status, orderId], (err) => {
        if (err) return res.status(500).send('상태 변경 실패');
        res.send(`<script>alert("주문 #${orderId}번의 상태가 [${status}](으)로 변경되었습니다."); location.href="/admin";</script>`);
    });
});

module.exports = router;