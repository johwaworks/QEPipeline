# 외부 접근 설정 완료 가이드

## 현재 상태
✅ 백엔드 서버: `http://localhost:5000` (실행 중)
✅ ngrok (백엔드): `https://unscrupulous-kimbra-headstrong.ngrok-free.dev`
✅ 프론트엔드 API URL: 모든 파일에서 ngrok URL로 변경 완료

## 다음 단계: 프론트엔드 외부 접근 설정

### 1단계: 프론트엔드 서버 실행

**방법 1: 배치 파일 사용**
- `START_FRONTEND.bat` 파일을 더블클릭

**방법 2: 터미널에서 실행**
```powershell
cd c:\Users\user\dev\QEPipeline\frontend
python -m http.server 8000
```

### 2단계: 프론트엔드용 ngrok 터널 생성

**새 터미널 창**을 열고:
```powershell
ngrok http 8000
```

새로운 ngrok URL이 생성됩니다!
예: `https://xyz789.ngrok-free.dev`

### 3단계: 다른 사람에게 공유

**프론트엔드 ngrok URL**을 다른 사람에게 공유하세요:
- 예: `https://xyz789.ngrok-free.dev`

이 URL로 접속하면:
1. 로그인 페이지가 표시됩니다
2. 로그인 후 대시보드가 표시됩니다
3. 모든 기능이 정상적으로 작동합니다

## 실행 중인 프로세스 확인

다음 4개가 모두 실행 중이어야 합니다:

1. ✅ 백엔드 서버 (포트 5000)
2. ✅ ngrok (백엔드) - `ngrok http 5000`
3. ⏳ 프론트엔드 서버 (포트 8000) - 아직 실행 필요
4. ⏳ ngrok (프론트엔드) - 아직 실행 필요

## 테스트 방법

1. **로컬 테스트**:
   - `http://localhost:8000` 접속 → 로그인 페이지 확인

2. **외부 접근 테스트**:
   - 프론트엔드 ngrok URL 접속 → 로그인 페이지 확인
   - 로그인 시도 → 정상 작동 확인

## 주의사항

⚠️ **중요**:
- ngrok을 재시작하면 URL이 변경됩니다
- URL이 변경되면 프론트엔드 코드의 `API_BASE_URL`도 업데이트해야 합니다
- 무료 플랜은 세션 시간 제한이 있습니다 (약 8시간)

## 문제 해결

### 프론트엔드가 로드되지 않는 경우:
1. 프론트엔드 서버가 실행 중인지 확인
2. 포트 8000이 사용 중인지 확인
3. ngrok이 올바른 포트(8000)로 연결되었는지 확인

### API 호출이 실패하는 경우:
1. 백엔드 ngrok URL이 올바른지 확인
2. 프론트엔드 코드의 `API_BASE_URL` 확인
3. 브라우저 콘솔에서 에러 메시지 확인

