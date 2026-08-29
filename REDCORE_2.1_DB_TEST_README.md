# REDCORE 2.1 — 주문 영구 저장 테스트

이번 버전은 개발/학습용으로 주문을 `server/data/orders.json`에 저장합니다.

## 테스트 방법
1. 기존 서버 창에서 `Ctrl + C`
2. `server` 폴더에서 `npm.cmd start`
3. `http://localhost:3000/api/health` 확인
4. 이전과 같은 방식으로 테스트 주문 생성
5. 주문번호를 확인
6. 서버 창에서 `Ctrl + C`
7. 다시 `npm.cmd start`
8. `http://localhost:3000/api/orders/주문번호` 접속
9. 주문이 그대로 나오면 성공

## 주의
JSON 파일 저장은 개발/학습용입니다. 실제 판매 전에는 DB, 관리자 인증, HTTPS, 개인정보 보호, 결제 승인 검증 등을 적용해야 합니다.
