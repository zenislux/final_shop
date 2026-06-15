const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db/database.sqlite');

// 주문 테이블이 없으면 자동으로 생성합니다.
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        total_price INTEGER NOT NULL,
        receiver_name TEXT NOT NULL,
        receiver_address TEXT NOT NULL,
        receiver_phone TEXT NOT NULL,
        status TEXT DEFAULT '결제완료',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        price INTEGER NOT NULL
    )`);
});

// 💳 [핵심] 가상 결제 및 주문 처리 라우터 (POST /order/confirm)
router.post('/confirm', (req, res) => {
    const user = req.session.user;

    // 1. 비로그인 차단
    if (!user) {
        return res.send('<script>alert("로그인이 필요합니다."); location.href="/user/login";</script>');
    }

    const username = user.username;
    // 장바구니 화면에서 입력받아 넘어올 배송 정보 데이터
    const { receiver_name, receiver_address, receiver_phone } = req.body;

    // 2. 장바구니 검사 및 상품 정보 긁어오기 (carts + products 조인)
    const cartQuery = `
        SELECT c.product_id, c.quantity, p.name, p.price 
        FROM carts c 
        JOIN products p ON c.product_id = p.id 
        WHERE c.username = ?`;

    db.all(cartQuery, [username], (err, cartItems) => {
        if (err) return res.status(500).send('장바구니 확인 실패');

        // 예외처리: 장바구니가 비어있으면 튕겨내기
        if (!cartItems || cartItems.length === 0) {
            return res.send('<script>alert("장바구니가 비어 있어 주문할 수 없습니다."); location.href="/cart";</script>');
        }

        // 3. 총 결제 금액 계산하기
        let totalPrice = 0;
        cartItems.forEach(item => {
            totalPrice += (item.price * item.quantity);
        });

        // 4. 유저의 최신 가상 포인트 잔액 조회하기
        db.get('SELECT point FROM users WHERE username = ?', [username], (userErr, userRow) => {
            if (userErr || !userRow) return res.status(500).send('유저 정보 조회 실패');

            // 예외처리: 잔액 부족시 튕겨내기
            if (userRow.point < totalPrice) {
                return res.send(`<script>alert("잔액이 부족합니다!\\n💰 현재 포인트: ${userRow.point}원\\n🛒 결제 금액: ${totalPrice}원"); history.back();</script>`);
            }

            // 5. [돈 깎기] 유저 포인트 차감 변동 적용
            db.run('UPDATE users SET point = point - ? WHERE username = ?', [totalPrice, username], (updateErr) => {
                if (updateErr) return res.status(500).send('포인트 차감 실패');

                // 세션 포인트 정보도 최신화해서 화면에 바로 반영
                req.session.user.point = userRow.point - totalPrice;

                // 6. [영수증 발행 1단계] orders 마스터 테이블에 인서트
                const insertOrder = `
                    INSERT INTO orders (username, total_price, receiver_name, receiver_address, receiver_phone) 
                    VALUES (?, ?, ?, ?, ?)`;

                db.run(insertOrder, [username, totalPrice, receiver_name, receiver_address, receiver_phone], function(orderErr) {
                    if (orderErr) return res.status(500).send('주문서 생성 실패');

                    const orderId = this.lastID; // 방금 생성된 주문 번호(ID)

                    // 7. [영수증 발행 2단계] order_items 상세 테이블에 품목들 인서트
                    const insertItem = `INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)`;

                    // 여러 품목을 안전하게 다 넣기 위해 반복문으로 insert 실행
                    let completed = 0;
                    cartItems.forEach(item => {
                        db.run(insertItem, [orderId, item.product_id, item.quantity, item.price], (itemErr) => {
                            completed++;

                            // 모든 품목이 주문 상세 테이블에 다 들어갔다면
                            if (completed === cartItems.length) {
                                // 8. [장바구니 비우기] 결제가 끝났으니 장바구니를 청소
                                db.run('DELETE FROM carts WHERE username = ?', [username], (clearErr) => {
                                    if (clearErr) return res.status(500).send('장바구니 비우기 실패');

                                    // 9. 대성공 알림 후 마이페이지(주문내역 확인용)로 이동!
                                    res.send(`<script>alert("🎉 가상 결제가 성공적으로 완료되었습니다!\\n🪙 차감 포인트: ${totalPrice.toLocaleString()}원\\n📱 마이페이지에서 주문 내역을 확인하세요."); location.href="/user/mypage";</script>`);
                                });
                            }
                        });
                    });
                });
            });
        });
    });
});

module.exports = router;