# 백엔드 URL 업데이트 가이드

## 문제 상황

✅ 백엔드 서버: 실행 중 (포트 5000)
❌ ngrok: 실행 중이지 않음

## 해결 방법

### 1단계: ngrok 재시작

1. **새 터미널 창 열기** (PowerShell 또는 CMD)

2. **ngrok 실행**:
   ```powershell
   ngrok http 5000
   ```

3. **ngrok URL 복사**:
   - 출력에서 `Forwarding` 라인 확인
   - 예: `https://xxxxx-xxxxx-xxxxx.ngrok-free.dev`
   - 이 URL을 복사하세요!

### 2단계: 프론트엔드 코드 업데이트

ngrok URL을 새 URL로 업데이트해야 합니다.

#### 방법 A: 수동 업데이트

모든 `.js` 파일에서 `API_BASE_URL` 찾아서 변경:
- `frontend/main.js`
- `frontend/dashboard.js`
- `frontend/project.js`
- `frontend/shot.js`
- `frontend/profile.js`
- `frontend/admin.js`
- `frontend/admin-project-deletion.js`

#### 방법 B: 자동 업데이트 스크립트 (준비 중)

### 3단계: GitHub에 푸시

1. 변경사항 커밋:
   ```powershell
   cd c:\Users\user\dev\QEPipeline
   git add frontend/*.js
   git commit -m "Update backend API URL"
   git push
   ```

2. Amplify 자동 재배포 대기 (약 2-5분)

### 4단계: 테스트

1. 배포된 프론트엔드 URL 접속
2. 로그인 시도
3. 브라우저 콘솔(F12)에서 에러 확인

## ngrok URL이 자주 변경되는 경우

### 해결책 1: ngrok 고정 도메인 (유료)

ngrok 유료 플랜에서 고정 도메인 사용 가능

### 해결책 2: AWS Lightsail로 백엔드 배포 (권장)

- 고정 URL 제공
- 안정적인 서비스
- 월 $3.5부터 시작

### 해결책 3: 환경 변수 사용

Amplify 환경 변수로 API URL 설정:
1. Amplify Console → 앱 선택
2. Environment variables
3. `REACT_APP_API_URL` 추가
4. 프론트엔드 코드 수정 필요

