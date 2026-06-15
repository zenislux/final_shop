const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const router = express.Router();
const dbPath = path.join(__dirname, '../db/database.sqlite');
const db = new sqlite3.Database(dbPath);

const multer = require('multer'); // 사진이나 문서 저장규칙

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../public/uploads'));
    },
    filename: function (req, file, cb) {
        // 한글 깨짐 방지: Latin1로 잘못 읽은 파일명을 원래의 UTF-8(한글)로 복구
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');

        // 이제 복구된 originalName을 사용해서 파일명을 만듭니다.
        const uniqueName = Date.now() + '-' + originalName;
        cb(null, uniqueName);
    }
});
const upload = multer({ storage: storage });


// 게시글 목록 불러오기
router.get('/', (req, res) => {
    db.all(`
        SELECT * FROM posts ORDER BY 
        COALESCE(parent_id, id), id ASC
    `, [], (err, posts) => {
        if (err) return res.send('목록 불러오기 실패');
        res.render('board', { title: '고객센터 게시판',posts }); // DB에서 꺼내온 데이터를 Board.ejs로 전달
    });
});

// 글쓰기 폼
router.get('/new', (req, res) => {
    res.render('post', {post: null, parentId: null });
});

// 글쓰기 처리 사용자가 post.ejs(글쓰기 화면)에서 제목과 내용을 적고 [저장] 버튼을 눌렀을 때, 그 데이터를 받아서 데이터베이스(posts 테이블)에 저장(INSERT)
// router.post('/new', (req, res) => {
//     const { title, content, parent_id } = req.body;
//     const author = req.session.user?.username || '익명';
//
//     db.run(
//         'INSERT INTO posts (title, content, parent_id, author) VALUES (?, ?, ?, ?)',
//         [title, content, parent_id || null, author],
//         function (err) {
//             if (err) return res.send('작성 실패');
//             res.redirect('/board');
//         }
//     );
// });


// 글쓰기 처리 (파일 첨부 기능 포함 d완성본)
// ⭐ upload.single('file') 미들웨어가 중간에 껴서 파일을 가로채어 uploads 폴더에 저장해 줍니다.
router.post('/new', upload.single('file'), (req, res) => {
    const { title, content, parent_id } = req.body;
    const author = req.session.user?.username || '익명';

    // 1. 게시글 텍스트 먼저 posts 테이블에 저장
    db.run(
        'INSERT INTO posts (title, content, parent_id, author) VALUES (?, ?, ?, ?)',
        [title, content, parent_id || null, author],
        function (err) {
            if (err) return res.send('작성 실패');

            const postId = this.lastID; // ⭐ 방금 데이터베이스에 저장된 새 글의 번호(id)를 가져옵니다.

            // 2. 만약 사용자가 파일을 첨부했다면 (req.file이 존재한다면)
            if (req.file) {
                // ⭐ 추가: DB에 글자를 넣기 직전에 원본 이름(originalname)도 한글로 복구
                const safeOriginalName = req.file.filename.substring(req.file.filename.indexOf('-') + 1);
                // files 테이블에 방금 쓴 글 번호(postId)와 묶어서 파일 정보를 저장합니다.
                db.run(
                    'INSERT INTO files (post_id, filename, original_name) VALUES (?, ?, ?)',
                    [postId, req.file.filename, safeOriginalName], // 👈 방금 잘라낸 진짜 한글 이름을 넣습니다.
                    (ferr) => {
                        if (ferr) console.error('파일 저장 실패:', ferr);
                        res.redirect('/board'); // 다 끝났으면 게시판 목록으로 이동
                    }
                );
            } else {
                // 첨부파일이 없으면 그냥 바로 게시판 목록으로 이동
                res.redirect('/board');
            }
        }
    );
});

// 글 상세
// router.get('/view/:id', (req, res) => {
//     const postId = req.params.id;
//
//     db.get('SELECT * FROM posts WHERE id = ?', [postId], (err, post) => {
//         if (err || !post) return res.send('글 없음');
//         res.render('detail', { post });
//     });
// });

// 글 상세 + 파일조회
router.get('/view/:id', (req, res) => {
    const postId = req.params.id;

    db.get('SELECT * FROM posts WHERE id = ?', [postId], (err, post) => {
        if (err || !post) return res.send('글 없음');

        // DB에서 파일 목록(files)을 찾아옵니다.
        db.all('SELECT * FROM files WHERE post_id = ?', [postId], (ferr, files) => {
            if (ferr) {
                console.error('파일 조회 에러:', ferr);
                return res.render('detail', { post, files: [] });
            }

            // ⭐ 핵심: 기존에 빈 배열 [] 로 되어있던 것을 진짜 files 데이터로 바꿔줍니다!
            res.render('detail', { post, files: files });
        });
    });
});


// 답글 달기 폼
//
// router.get('/reply/:id', (req, res) => {
//     const parentId = req.params.id;
//     res.render('post', {post: null, parentId });
// });

router.get('/reply/:id', (req, res) => {
    const parentId = req.params.id;
    db.get("SELECT title FROM posts WHERE id = ?", [parentId], (err, row) => {
        if (err || !row) return res.send("원글 없음");
        res.render('reply', { parentId, parentTitle: row.title });
    });
});

// 댓글 달기 post
router.post('/create', (req, res) => {
    const { author, title, content, parent_id } = req.body;
    db.run(
        'INSERT INTO posts (author, title, content, parent_id) VALUES (?, ?, ?, ?)',
        [author, title, content, parent_id || null],
        function (err) {
            if (err) return res.send('등록 실패');
            res.redirect('/board');
        }
    );
});


// 수정 폼
router.get('/edit/:id', (req, res) => {
    db.get('SELECT * FROM posts WHERE id = ?', [req.params.id], (err, post) => {
        if (err || !post) return res.send('글 없음');
        res.render('edit',{ post });
        //res.render('post', { post });
    });
});

// 수정 처리
router.post('/edit/:id', (req, res) => {
    const { title, content } = req.body;
    //const postId = req.params.id;
    db.run(
        'UPDATE posts SET title = ?, content = ? WHERE id = ?',
        [title, content, req.params.id],
        (err) => {
            if (err) return res.send('수정 실패');
            res.redirect('/board/view/' + req.params.id);
        }
    );
});

// 삭제
router.get('/delete/:id', (req, res) => {
    db.run('DELETE FROM posts WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.send('삭제 실패');
        res.redirect('/board');
    });
});

module.exports = router;
