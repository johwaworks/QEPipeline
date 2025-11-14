# 임시 도메인 설정 가이드 (ngrok 사용)

## 1. ngrok 설치

### Windows에서 설치:
1. https://ngrok.com/download 에서 Windows 버전 다운로드
2. 다운로드한 `ngrok.exe`를 원하는 폴더에 압축 해제 (예: `C:\ngrok\`)
3. 환경 변수 PATH에 ngrok 폴더 추가 (선택사항)

또는 Chocolatey 사용:
```powershell
choco install ngrok
```

## 2. ngrok 계정 생성 및 인증

1. https://ngrok.com/ 에서 무료 계정 생성
2. 대시보드에서 Authtoken 복사
3. 터미널에서 인증:
```powershell
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

## 3. 백엔드 서버 실행

백엔드 서버를 실행합니다:
```powershell
cd c:\Users\user\dev\QEPipeline\backend
python app.py
```

## 4. ngrok으로 터널 생성

새 터미널 창을 열고:
```powershell
ngrok http 5000
```

또는 백엔드 포트가 다르다면:
```powershell
ngrok http YOUR_PORT
```

## 5. 공유 URL 확인

ngrok 실행 시 다음과 같은 정보가 표시됩니다:
```
Forwarding   https://abc123.ngrok.io -> http://localhost:5000
```

- **HTTPS URL**: `https://abc123.ngrok.io` (이것을 다른 사람에게 공유)
- **HTTP URL**: `http://abc123.ngrok.io` (또 다른 옵션)

## 6. 프론트엔드 설정 변경

### 옵션 1: API_BASE_URL 변경 (임시)
`frontend/dashboard.js`, `frontend/project.js` 등에서:
```javascript
const API_BASE_URL = "https://abc123.ngrok.io";  // ngrok URL로 변경
```

### 옵션 2: 환경 변수 사용 (권장)
프론트엔드에서 ngrok URL을 자동으로 감지하거나 환경 변수로 설정

### 옵션 3: 프론트엔드도 ngrok으로 공유
프론트엔드 서버(예: Python HTTP 서버)를 다른 포트(예: 8000)에서 실행:
```powershell
cd c:\Users\user\dev\QEPipeline\frontend
python -m http.server 8000
```

그리고 다른 ngrok 터미널에서:
```powershell
ngrok http 8000
```

## 7. MongoDB 접근

MongoDB가 로컬에 있다면:
- MongoDB도 외부 접근이 가능해야 함
- 또는 MongoDB Atlas(클라우드) 사용 권장
- MongoDB 포트(27017)도 ngrok으로 노출 가능:
```powershell
ngrok tcp 27017
```

## 주의사항

1. **무료 플랜 제한**:
   - URL이 매번 바뀜 (ngrok 재시작 시)
   - 세션 시간 제한 있음 (8시간)
   - 월 트래픽 제한 (40MB)

2. **고정 URL 원하는 경우**:
   - ngrok 유료 플랜 필요 ($8/월)
   - 또는 다른 서비스 사용 (Cloudflare Tunnel 무료)

3. **보안**:
   - ngrok URL은 누구나 접근 가능
   - 테스트 용도로만 사용 권장

## 대안: Cloudflare Tunnel (무료, 고정 도메인)

1. Cloudflare 계정 생성
2. `cloudflared` 설치
3. 실행:
```powershell
cloudflared tunnel --url http://localhost:5000
```

무료로 고정 도메인 제공 (예: `https://yourname.trycloudflare.com`)

