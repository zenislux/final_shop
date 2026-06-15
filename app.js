var createError = require('http-errors');
var express = require('express');
const path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const session = require('express-session');
const boardRouter = require('./routes/board');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
const userRouter = require('./routes/user');
const productRouter = require('./routes/products');
const cartRouter = require('./routes/cart');
const orderRouter = require('./routes/order');
const wishRouter = require('./routes/wish');
const adminRouter = require('./routes/admin');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: true,
}));

// 아래 미들웨어 위치는 app.use('/', indexRouter); 보다 위에 있어야 함
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/user',userRouter);
app.use('/board', boardRouter);
app.get('/login', (req,res)=> {
  res.redirect('/user/login');
});
app.use('/products',productRouter);
app.use('/cart', cartRouter);
app.use('/order',orderRouter);
app.use('/wish', wishRouter);
app.use('/admin', adminRouter);

app.use(express.static(path.join(__dirname, 'public')));


// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

app.use((req, res) => {
  res.status(404).send(`404 NOT FOUND: ${req.originalUrl}`);
});

/* Admin 테스트용
const sqlite3 = require('sqlite3').verbose();
const tempDb = new sqlite3.Database('./db/database.sqlite');
tempDb.run("UPDATE users SET is_admin = 1 WHERE username = 'qwert'", function(err) {
  if(!err) console.log("👑 qwert 계정이 관리자로 임명되었습니다.");
});
*/

const sqlite3 = require('sqlite3').verbose();
const initDb = new sqlite3.Database('./db/database.sqlite');

initDb.serialize(() => {
  // 1. 기존 products 테이블이 있다면 깔끔하게 제거
  initDb.run('DROP TABLE IF EXISTS products', () => {

    // 2. schema.sql에 명시된 교수님의 원래 구조 그대로 테이블 생성!
    initDb.run(`CREATE TABLE products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            price INTEGER NOT NULL,
            emoji TEXT,
            image TEXT,
            likes INTEGER DEFAULT 0,
            is_featured INTEGER DEFAULT 0
        )`, () => {

      // 3. public/images 폴더 내 파일명과 매칭되는 오리지널 8종 라인업 데이터
      // [name, description, price, emoji, image, likes, is_featured]
      const fruits = [
        // 💡 파일명 앞에 'images/'를 직접 붙여서 DB에 저장합니다!
        ['싱싱한 사과', '아침에 먹으면 황금 같은 달콤한 국산 사과', 3000, '🍎', 'images/original/apple.png', 12, 1],
        ['부드러운 바나나', '당도 최고! 든든한 다이어트 친구 필리핀 바나나', 4500, '🍌', 'images/original/banana.png', 8, 1],
        ['상큼한 포도', '한 알씩 쏙쏙 빼먹는 재미가 있는 달달한 캠벨 포도', 7000, '🍇', 'images/original/grape.png', 15, 1],
        ['새콤달콤 키위', '비타민C가 풍부해 피로 해소에 좋은 뉴질랜드 골드키위', 3500, '🥝', 'images/original/kiwi.png', 5, 1],
        ['싱그러운 오렌지', '과즙이 팡팡 터지는 고당도 캘리포니아 오렌지', 2500, '🍊', 'images/original/orange.png', 9, 1],
        ['달콤한 복숭아', '풍부한 과즙과 은은한 향이 일품인 부드러운 백도 복숭아', 5500, '🍑', 'images/original/peach.png', 21, 1],
        ['시원한 수박', '여름철 더위를 한방에 날려줄 속이 꽉 찬 당도 선별 수박', 18000, '🍉', 'images/original/watermelon.png', 34, 1]
      ];

      const stmt = initDb.prepare('INSERT INTO products (name, description, price, emoji, image, likes, is_featured) VALUES (?, ?, ?, ?, ?, ?, ?)');
      fruits.forEach(fruit => {
        stmt.run(fruit);
      });
      stmt.finalize(() => {
        console.log("🍏 🍇 [복구 완료] 오리지널 과일 7종 이미지 및 스펙 동기화 완료!");
      });
    });
  });
});

module.exports = app;

