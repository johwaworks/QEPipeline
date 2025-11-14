# 백엔드 연결 문제 해결 가이드

## 문제 상황

프론트엔드 배포는 성공했지만 백엔드 연결이 안 되어 로그인이 안 됨

## 현재 설정

- 프론트엔드 API URL: `https://unscrupulous-kimbra-headstrong.ngrok-free.dev`
- 백엔드 CORS: 모든 도메인 허용 (`origins="*"`)

## 확인해야 할 사항

### 1. 백엔드 서버 실행 확인

```powershell
# 백엔드 서버가 실행 중인지 확인
# 포트 5000이 사용 중인지 확인
netstat -ano | findstr :5000
```

### 2. ngrok 실행 확인

```powershell
# ngrok이 실행 중인지 확인
# ngrok 프로세스 확인
tasklist | findstr ngrok
```

### 3. ngrok URL 확인

1. ngrok 웹 인터페이스 확인: http://127.0.0.1:4040
2. Forwarding URL 확인
3. 현재 프론트엔드에 설정된 URL과 일치하는지 확인

## 해결 방법

### 방법 1: 백엔드 서버 및 ngrok 재시작

1. **백엔드 서버 시작**:
   ```powershell
   cd c:\Users\user\dev\QEPipeline\backend
   python app.py
   ```

2. **새 터미널에서 ngrok 시작**:
   ```powershell
   ngrok http 5000
   ```

3. **ngrok URL 복사**:
   - ngrok 출력에서 `Forwarding` URL 복사
   - 예: `https://xxxxx-xxxxx-xxxxx.ngrok-free.dev`

4. **프론트엔드 코드 업데이트**:
   - 모든 `.js` 파일의 `API_BASE_URL`을 새 ngrok URL로 변경
   - GitHub에 커밋 및 푸시
   - Amplify 자동 재배포 대기

### 방법 2: 환경 변수 사용 (권장)

프론트엔드 코드를 수정하여 환경 변수나 설정 파일에서 API URL을 읽도록 변경

### 방법 3: AWS Lightsail로 백엔드 배포

ngrok 대신 AWS Lightsail로 백엔드를 배포하여 고정 URL 사용

## 빠른 확인 방법

### 브라우저 콘솔 확인

1. 배포된 프론트엔드 URL 접속
2. F12 → Console 탭
3. 에러 메시지 확인:
   - CORS 에러
   - 네트워크 에러
   - 404 에러

### 네트워크 탭 확인

1. F12 → Network 탭
2. 로그인 시도
3. API 요청 확인:
   - 요청 URL 확인
   - 응답 상태 코드 확인
   - 응답 내용 확인

## 임시 해결책

백엔드를 로컬에서 테스트하려면:

1. **로컬 프론트엔드 서버 실행**:
   ```powershell
   cd c:\Users\user\dev\QEPipeline\frontend
   python -m http.server 8000
   ```

2. **로컬에서 접속**: `http://localhost:8000`

3. **ngrok URL 확인**:
   - ngrok이 실행 중이고 올바른 URL을 제공하는지 확인

