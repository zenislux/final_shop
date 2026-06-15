const express = require('express');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const router = express.Router();
const dbPath = path.join(__dirname, '../db/database.sqlite');
const db = new sqlite3.Database(dbPath);


// 회원가입 약관 동의 페이지 렌더링
router.get('/terms', (req, res) => {
    res.render('terms');
});
// 회원가입 페이지
router.get('/register', (req, res) => {
    res.render('register'); //register.ejs
});

// routes/user.js - 회원가입 처리 라우터 수정
router.post('/register', async (req, res) => {
    const { username, password, name, email_local, email_domain } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    let fullEmail = null;
    if (email_local && email_domain) {
        fullEmail = `${email_local}@${email_domain}`;
    }

    db.run(
        'INSERT INTO users (username, password, name, email, point, is_admin) VALUES (?, ?, ?, ?, 30000, 0)',
        [username, hashedPassword, name, fullEmail],
        (err) => {
            if (err) {
                console.error('❌ 회원가입 진짜 에러 원인:', err.message);
                return res.send('회원가입 실패 원인: ' + err.message);
            }

            // 바로 리다이렉트 하지 않고 브라우저에 알림창을 띄운 뒤 이동
            res.send(`
                <script>
                    alert('🎉 회원가입이 성공적으로 완료되었습니다! 회원가입 감사 선물로 3만포인트 지급되었습니다. 로그인 후 이용해 주세요.');
                    location.href = '/user/login';
                </script>
            `);
        }
    );
});

// 로그인 페이지
router.get('/login', (req, res) => {
    res.render('login'); //login.ejs
});

// 로그인 처리
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        if (err || !user) {
            return res.send('존재하지 않는 사용자입니다.');
        }

        const match = await bcrypt.compare(password, user.password);
        if (match) {
            req.session.user = user;
            res.redirect('/');
        } else {
            res.status(401).render('login_failed');
        }
    });
});

// 로그아웃
// router.get('/logout', (req, res) => {
//     req.session.destroy();
//     res.redirect('/');
// });
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('❌ 로그아웃 오류:', err);
        }
        res.redirect('/');
    });
});

// [조회] 마이페이지 주문 내역 출력 라우터
router.get('/mypage', (req, res) => {
    const user = req.session.user;
    if (!user) return res.redirect('/user/login');

    const username = user.username;

    // 1. 유저의 최신 정보(최신 포인트 잔액 반영용) 먼저 조회
    db.get('SELECT point, is_admin FROM users WHERE username = ?', [username], (userErr, currentUser) => {
        if (userErr) return res.status(500).send('유저 정보 갱신 실패');

        // 세션 포인트 동기화
        req.session.user.point = currentUser.point;

        // 2. 이 유저가 주문한 모든 마스터 내역 최신순 조회
        const orderQuery = `SELECT * FROM orders WHERE username = ? ORDER BY created_at DESC`;

        db.all(orderQuery, [username], (orderErr, orderRows) => {
            if (orderErr) return res.status(500).send('주문 내역 조회 실패');

            // 3. 주문 상세 품목(사과 몇 개 등)과 상품 테이블을 조인해서 긁어오기
            const itemsQuery = `
                SELECT oi.*, p.name, p.description
                FROM order_items oi
                JOIN products p ON oi.product_id = p.id
                WHERE oi.order_id IN (SELECT id FROM orders WHERE username = ?)
            `;

            db.all(itemsQuery, [username], (itemErr, itemRows) => {
                if (itemErr) return res.status(500).send('주문 상세 조회 실패');

                // 4. 화면(mypage.ejs)에 내 정보, 주문 마스터, 주문 상세 아이템을 통째로 전달!
                res.render('mypage', {
                    user: req.session.user,
                    orders: orderRows,
                    orderItems: itemRows
                });
            });
        });
    });
});

// [취소] 주문 취소 처리 라우터 (돈 환불 + 영수증 상태 변경)
router.post('/order/cancel', (req, res) => {
    const user = req.session.user;
    if (!user) return res.status(401).send('로그인이 필요합니다.');

    const { orderId, totalPrice } = req.body;
    const username = user.username;

    // 1. 배송이 이미 시작되었는지 상태 체크 (배송준비중/배송중이면 취소 불가 예외처리)
    db.get('SELECT status FROM orders WHERE id = ? AND username = ?', [orderId, username], (err, order) => {
        if (err || !order) return res.send('<script>alert("주문 정보를 찾을 수 없습니다."); history.back();</script>');

        if (order.status !== '결제완료') {
            return res.send(`<script>alert("이미 '${order.status}' 상태이므로 취소가 불가능합니다.\\n고객센터로 문의하세요."); history.back();</script>`);
        }

        // 2. 환불 조치: 유저 테이블의 포인트를 다시 더해줍니다.
        db.run('UPDATE users SET point = point + ? WHERE username = ?', [totalPrice, username], (refundErr) => {
            if (refundErr) return res.status(500).send('환불 처리 실패');

            // 3. 주문 마스터 테이블의 상태를 '주문취소'로 업데이트
            db.run("UPDATE orders SET status = '주문취소' WHERE id = ?", [orderId], (statusErr) => {
                if (statusErr) return res.status(500).send('주문 상태 변경 실패');

                res.send(`<script>alert("주문이 성공적으로 취소되었으며, ${parseInt(totalPrice).toLocaleString()}포인트가 환불되었습니다."); location.href="/user/mypage";</script>`);
            });
        });
    });
});

// 회원 정보 수정 처리
router.post('/edit-profile', (req, res) => {
    if (!req.session.user) return res.send('로그인이 필요합니다.');

    const { name } = req.body; // 수정할 이름 받기
    const username = req.session.user.username;

    db.run('UPDATE users SET name = ? WHERE username = ?', [name, username], (err) => {
        if (err) return res.send('수정 실패');

        // 세션에 저장된 이름도 새 이름으로 업데이트
        req.session.user.name = name;
        res.send('<script>alert("정보가 수정되었습니다."); location.href="/user/mypage";</script>');
    });
});

// 회원 탈퇴 처리
router.post('/withdraw', (req, res) => {
    if (!req.session.user) return res.send('로그인이 필요합니다.');

    const username = req.session.user.username;

    // DB에서 유저 데이터를 완전히 삭제 (즉시 파기)
    db.run('DELETE FROM users WHERE username = ?', [username], (err) => {
        if (err) return res.send('탈퇴 처리 중 오류가 발생했습니다.');

        // 세션 파괴 (로그아웃 처리)
        req.session.destroy((serr) => {
            if (serr) console.error(serr);

            // 탈퇴 완료 페이지로 이동시키면서 탈퇴한 아이디를 쿼리스트링으로 넘겨줍니다.
            res.redirect('/user/goodbye?username=' + username);
        });
    });
});

// 탈퇴 완료 페이지 띄우기
router.get('/goodbye', (req, res) => {
    const username = req.query.username || '';
    res.render('goodbye', { username : username });
});

// 찾기 로직
// 1. 찾기 페이지 렌더링
router.get('/find', (req, res) => {
    res.render('find');
});

// 2. 아이디 찾기 처리
router.post('/find-id', (req, res) => {
    const { name, email_local, email_domain } = req.body;
    const fullEmail = `${email_local}@${email_domain}`;

    // 이름과 이메일이 동시에 일치하는 유저 찾기
    db.get('SELECT username FROM users WHERE name = ? AND email = ?', [name, fullEmail], (err, row) => {
        if (err || !row) {
            return res.send('<script>alert("일치하는 회원 정보가 없습니다."); history.back();</script>');
        }
        // 결과 화면에 아이디 전송
        res.render('find_result', { type: 'id', foundUsername: row.username, verifiedUser: null });
    });
});

// 3. 비밀번호 찾기 (비밀번호 변경 전 본인 인증 단계)
router.post('/find-pw', (req, res) => {
    const { username, name, email_local, email_domain } = req.body;
    const fullEmail = `${email_local}@${email_domain}`;

    // 아이디, 이름, 이메일이 모두 맞는지 검증
    db.get('SELECT username FROM users WHERE username = ? AND name = ? AND email = ?', [username, name, fullEmail], (err, row) => {
        if (err || !row) {
            return res.send('<script>alert("입력하신 정보가 일치하지 않습니다."); history.back();</script>');
        }
        // 검증 성공 시 결과 화면에 변경 권한 유저아이디 전송
        res.render('find_result', { type: 'pw', foundUsername: null, verifiedUser: row.username });
    });
});

// 4. 진짜 비밀번호 새로 변경 처리
router.post('/reset-pw', async (req, res) => {
    const { username, newPassword } = req.body;

    // 새 비밀번호도 해시(암호화)해서 저장
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    db.run('UPDATE users SET password = ? WHERE username = ?', [hashedNewPassword, username], (err) => {
        if (err) return res.send('비밀번호 변경 실패');

        res.send('<script>alert("비밀번호가 성공적으로 변경되었습니다. 새 비밀번호로 로그인해 주세요."); location.href="/user/login";</script>');
    });
});

// 🪙 [충전] 가상 포인트 충전 처리 라우터 (POST /user/point/charge)
router.post('/point/charge', (req, res) => {
    const user = req.session.user;
    if (!user) return res.status(401).send('로그인이 필요합니다.');

    const username = user.username;
    const chargeAmount = parseInt(req.body.amount); // 사용자가 입력한 충전 금액

    // 입력값 유효성 검사 (0 이하의 잘못된 값 방지)
    if (isNaN(chargeAmount) || chargeAmount <= 0) {
        return res.send('<script>alert("올바른 금액을 입력해주세요."); history.back();</script>');
    }

    // 1. 현재 보유 중인 포인트가 얼마인지 DB에서 먼저 조회
    db.get('SELECT point FROM users WHERE username = ?', [username], (err, row) => {
        if (err || !row) return res.status(500).send('유저 조회 실패');

        const currentPoint = row.point;
        const expectedPoint = currentPoint + chargeAmount; // 충전 후 예상 금액

        // 🛑 [예외] 최대 한도 100만 원 제한!
        if (expectedPoint > 1000000) {
            return res.send(`<script>
                alert("❌ 충전 실패! 최대 보유 한도를 초과합니다.\\n\\n현재 보유 포인트: ${currentPoint.toLocaleString()}원\\n입력한 충전 금액: ${chargeAmount.toLocaleString()}원\\n최대 보유 가능 금액은 1,000,000원입니다.");
                history.back();
            </script>`);
        }

        // 2. 한도 통과 시 DB에 포인트 더해주기
        db.run('UPDATE users SET point = point + ? WHERE username = ?', [chargeAmount, username], (updateErr) => {
            if (updateErr) return res.status(500).send('포인트 충전 실패');

            // 3. 현재 세션 정보도 즉시 갱신해서 화면에 바로 반영되게 만듭니다.
            req.session.user.point = expectedPoint;

            res.send(`<script>alert("🪙 가상 포인트 ${chargeAmount.toLocaleString()}원이 성공적으로 충전되었습니다!"); location.href="/user/mypage";</script>`);
        });
    });
});

module.exports = router;
