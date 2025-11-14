# ngrok 브라우저 경고 페이지 해결

## 문제

로그인은 되지만 데이터가 안 불러와지는 문제. 브라우저 콘솔에 "Unexpected token '<'" 에러 발생.

## 원인

ngrok 무료 플랜은 브라우저에서 직접 접근할 때 경고 페이지를 보여줍니다. 이로 인해 API 응답이 HTML로 반환되어 JSON 파싱 오류가 발생합니다.

## 해결

모든 fetch 호출에 `ngrok-skip-browser-warning: true` 헤더를 추가했습니다.

## 수정된 파일

1. ✅ `frontend/dashboard.js` - apiFetch 함수 추가 및 모든 fetch 호출 변경
2. ✅ `frontend/main.js` - apiFetch 함수 추가 및 모든 fetch 호출 변경
3. ✅ `frontend/project.js` - apiFetch 함수 추가 및 모든 fetch 호출 변경
4. ✅ `frontend/shot.js` - apiFetch 함수 추가 및 모든 fetch 호출 변경
5. ⏭️ `frontend/profile.js` - 수정 필요
6. ⏭️ `frontend/admin.js` - 수정 필요
7. ⏭️ `frontend/admin-project-deletion.js` - 수정 필요

## 다음 단계

1. 나머지 파일들도 수정
2. GitHub에 커밋 및 푸시
3. Amplify 자동 재배포 대기
4. 테스트

