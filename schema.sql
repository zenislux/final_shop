-- 사용자 테이블
CREATE TABLE IF NOT EXISTS users (
                                     id INTEGER PRIMARY KEY AUTOINCREMENT,
                                     username TEXT UNIQUE NOT NULL,
                                     password TEXT NOT NULL,
                                     name TEXT NOT NULL,
                                     email TEXT
                                     is_admin INTEGER DEFAULT 0, -- 💡 0: 일반회원, 1: 관리자
                                     point INTEGER DEFAULT 0     -- 💡 가상 결제용 포인트 (기본값 0원)
);

-- 장바구니 테이블
CREATE TABLE IF NOT EXISTS carts (
                                     id INTEGER PRIMARY KEY AUTOINCREMENT,
                                     username TEXT NOT NULL,       -- 어떤 유저의 장바구니인지
                                     product_id INTEGER NOT NULL,  -- 어떤 상품을 담았는지
                                     quantity INTEGER DEFAULT 1,   -- 몇 개나 담았는지
                                     FOREIGN KEY(username) REFERENCES users(username)
    );

-- 상품 테이블
CREATE TABLE IF NOT EXISTS products (
                                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                                        name TEXT NOT NULL,
                                        price INTEGER NOT NULL,
                                        description TEXT,
                                        image_url TEXT
);

-- 게시글 테이블
CREATE TABLE IF NOT EXISTS posts (
                                     id INTEGER PRIMARY KEY AUTOINCREMENT,
                                     title TEXT NOT NULL,
                                     content TEXT NOT NULL,
                                     parent_id INTEGER,
                                     author TEXT NOT NULL,
                                     created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

--  상품목록 테이블
CREATE TABLE IF NOT EXISTS products (
                                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                                        name TEXT NOT NULL,              -- 상품명
                                        description TEXT,                -- 상품 설명
                                        price INTEGER NOT NULL,          -- 가격 (원 단위)
                                        emoji TEXT,                      -- 이모지 (간단한 시각적 표시용)
                                        image TEXT,                      -- 이미지 파일 경로
                                        likes INTEGER DEFAULT 0,         -- 선호도 (추천수, 고객클릭수 등)
                                        is_featured INTEGER DEFAULT 0    -- 오늘의 추천 상품 여부 (1=추천)
);

-- 장바구니 테이블

DROP TABLE IF EXISTS cart_items;
CREATE TABLE cart_items (
                            user_id INTEGER NOT NULL,
                            product_id INTEGER NOT NULL,
                            quantity INTEGER DEFAULT 1,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            PRIMARY KEY(user_id, product_id)
);

-- 첨부파일 테이블
CREATE TABLE IF NOT EXISTS files (
                                     id INTEGER PRIMARY KEY AUTOINCREMENT,
                                     post_id INTEGER NOT NULL,            -- 어떤 게시글에 달린 파일인지 (posts 테이블의 id)
                                     filename TEXT NOT NULL,              -- 서버에 저장된 실제 파일 이름 (예: 16234234-apple.png)
                                     original_name TEXT NOT NULL,         -- 사용자가 올린 원래 파일 이름 (예: apple.png)
                                     FOREIGN KEY(post_id) REFERENCES posts(id)
    );