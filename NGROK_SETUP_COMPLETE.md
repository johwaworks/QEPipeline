# ngrok 설정 완료 가이드

## 현재 상태
- ✅ ngrok 터널 생성 완료: `https://unscrupulous-kimbra-headstrong.ngrok-free.dev`
- ✅ 백엔드 API URL 변경 완료 (모든 프론트엔드 파일)
- ✅ 백엔드 루트 경로 추가 완료

## 다른 사람에게 공유하는 방법

### 방법 1: 프론트엔드도 HTTP 서버로 제공 (추천)

1. **프론트엔드 서버 실행**:
   ```powershell
   cd c:\Users\user\dev\QEPipeline\frontend
   python -m http.server 8000
   ```

2. **프론트엔드용 ngrok 터널 생성** (새 터미널):
   ```powershell
   ngrok http 8000
   ```

3. **공유 URL**:
   - 프론트엔드 URL (예: `https://xyz123.ngrok-free.dev`)을 다른 사람에게 공유
   - 이 URL로 접속하면 전체 애플리케이션 사용 가능

### 방법 2: 프론트엔드 파일을 직접 공유

- 프론트엔드 HTML 파일들을 공유하고, 각자 브라우저에서 열도록 안내
- 다만 이 경우 각 사용자의 브라우저가 ngrok URL에 접근할 수 있어야 함

## 실행 순서

### 1단계: 백엔드 실행
```powershell
cd c:\Users\user\dev\QEPipeline\backend
python app.py
```

### 2단계: ngrok (백엔드) 실행
```powershell
ngrok http 5000
```
- URL 확인: `https://unscrupulous-kimbra-headstrong.ngrok-free.dev`

### 3단계: 프론트엔드 서버 실행
```powershell
cd c:\Users\user\dev\QEPipeline\frontend
python -m http.server 8000
```

### 4단계: ngrok (프론트엔드) 실행 (새 터미널)
```powershell
ngrok http 8000
```
- 새로운 URL 생성됨 (예: `https://abc456.ngrok-free.dev`)

### 5단계: 공유
- 프론트엔드 ngrok URL을 다른 사람에게 공유
- 예: `https://abc456.ngrok-free.dev`

## 테스트

1. 백엔드 확인:
   - `https://unscrupulous-kimbra-headstrong.ngrok-free.dev/` 접속
   - JSON 응답이 나오면 정상

2. 프론트엔드 확인:
   - 프론트엔드 ngrok URL 접속
   - 로그인 페이지가 보이면 정상

## 중요 사항

⚠️ **주의사항**:
- ngrok을 재시작하면 URL이 변경됩니다
- 두 ngrok 터널이 모두 실행 중이어야 합니다 (백엔드용, 프론트엔드용)
- MongoDB가 외부 접근 가능해야 합니다 (로컬 MongoDB인 경우)

## MongoDB 외부 접근

로컬 MongoDB를 사용 중이라면:
- MongoDB Atlas(클라우드) 사용 권장
- 또는 MongoDB 포트(27017)도 ngrok으로 노출:
```powershell
ngrok tcp 27017
```

## 다음 단계 (나중에)

프로덕션 배포 시:
- VPS나 클라우드 서버 사용
- 실제 도메인 연결
- SSL 인증서 설정
- MongoDB Atlas 사용

