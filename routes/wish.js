const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db/database.sqlite');

//  위시리스트 테이블이 없으면 자동으로 만듦
db.run(`CREATE TABLE IF NOT EXISTS wishes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    product_id INTEGER NOT NULL
)`);

// ❤️ 위시리스트 추가 처리 (/wish/add/:id)
router.get('/add/:id', (req, res) => {
    const user = req.session.user;
    const productId = req.params.id;

    if (!user) {
        return res.send('<script>alert("위시리스트를 이용하시려면 로그인이 필요합니다."); location.href="/user/login";</script>');
    }

    const username = user.username;

    // 이미 위시리스트에 존재하는지 확인 (수량 증가가 아니라 중복 차단만)
    db.get('SELECT * FROM wishes WHERE username = ? AND product_id = ?', [username, productId], (err, row) => {
        if (err) return res.status(500).send('위시리스트 오류');

        if (row) {
            return res.send('<script>alert("이미 위시리스트에 담긴 상품입니다!"); history.back();</script>');
        } else {
            // 위시리스트에 새로 저장
            db.run('INSERT INTO wishes (username, product_id) VALUES (?, ?)', [username, productId], (iErr) => {
                if (iErr) return res.send('위시리스트 추가 실패');
                res.send('<script>alert("❤️ 위시리스트에 추가되었습니다!"); history.back();</script>');
            });
        }
    });
});

module.exports = router;