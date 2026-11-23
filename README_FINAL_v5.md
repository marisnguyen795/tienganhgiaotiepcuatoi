# FINAL v5 CLEAN - Giao dien sach nhu ban trong o chat

## Khac v4 o dau?
- v4 de 2 hop to 'Kiem tra Noi' + 'AI thong minh' + doan giai thich dai tren Trang chu -> nhin roi, cui.
- v5: GIAU het phan chan doan vao Cai dat (sau mat khau). Trang chu chi con: Hoc tiep, Ke hoach hom nay, Chon chu de, Danh sach bai, Cum hay dung, Import. Sach nhu ban Reflex.
- Tinh nang giu nguyen 100%: 72 bai, 60 cau Viet->Anh, 1000 tu, Noi (Mic+Gõ fallback), Nghe, AI Chat, AI Fallback Gemini->Meta->Offline, Import, Khoa Cai dat, Supabase.

## Up len Vercel
1. Xoa het file cu trong repo. Chi de 5 file: index.html, vercel.json, package.json, build.js, README nay
2. Vercel Settings: Framework Other, Build npm run build, Output dist
3. Deployment Protection: Disabled hoac Only Production (de khong bi trang Login)
4. Redeploy, mo bang domain chinh hoctienganhgiaotiep.vercel.app, Ctrl+Shift+R
