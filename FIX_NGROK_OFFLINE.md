# ngrok "endpoint is offline" 오류 해결 방법

## 오류 원인
- 백엔드 서버가 응답하지 않음
- 백엔드 서버가 크래시됨
- ngrok 연결이 끊어짐

## 해결 방법

### 1단계: 백엔드 서버 재시작

1. **현재 실행 중인 백엔드 서버 종료**:
   - 백엔드 서버를 실행한 터미널에서 `Ctrl+C`로 종료

2. **백엔드 서버 재시작**:
   ```powershell
   cd c:\Users\user\dev\QEPipeline\backend
   python app.py
   ```

3. **서버가 정상적으로 시작되었는지 확인**:
   - "Running on http://0.0.0.0:5000" 메시지 확인
   - 에러 메시지가 없어야 함

### 2단계: ngrok 재시작

1. **현재 실행 중인 ngrok 종료**:
   - ngrok을 실행한 터미널에서 `Ctrl+C`로 종료

2. **ngrok 재시작**:
   ```powershell
   ngrok http 5000
   ```

3. **새로운 URL 확인**:
   - 새로운 URL이 생성될 수 있습니다
   - 프론트엔드 코드의 `API_BASE_URL`도 새 URL로 업데이트 필요

### 3단계: 연결 확인

브라우저에서:
- `http://localhost:5000/` 접속 → JSON 응답 확인
- ngrok URL 접속 → 동일한 JSON 응답 확인

## 자동 재시작 스크립트 (선택사항)

문제가 계속 발생한다면:
1. 백엔드 서버가 자동으로 재시작되도록 설정
2. 또는 프로세스 모니터링 도구 사용 (PM2, supervisor 등)

## 참고

- ngrok을 재시작하면 URL이 변경될 수 있습니다 (무료 플랜)
- URL이 변경되면 프론트엔드 코드도 업데이트해야 합니다
- MongoDB 연결 상태도 확인하세요

