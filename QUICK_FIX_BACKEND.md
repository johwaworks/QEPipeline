# 백엔드 연결 빠른 해결 가이드

## 현재 상황

✅ 백엔드 서버: 실행 중 (포트 5000)
❌ ngrok: 실행 중이지 않음
❌ 프론트엔드: 구 ngrok URL 사용 중

## 빠른 해결 방법

### 1단계: ngrok 시작

**새 터미널 창**을 열고 아래 명령어 실행:

```powershell
ngrok http 5000
```

### 2단계: ngrok URL 복사

ngrok 출력에서 **Forwarding** 라인 확인:
```
Forwarding https://xxxxx-xxxxx-xxxxx.ngrok-free.dev -> http://localhost:5000
```

이 URL을 복사하세요! (예: `https://xxxxx-xxxxx-xxxxx.ngrok-free.dev`)

### 3단계: 프론트엔드 코드 업데이트

#### 방법 A: 배치 파일 사용 (쉬움) ⭐

1. `UPDATE_API_URL.bat` 파일 더블클릭
2. 새 ngrok URL 입력
3. Enter 키 누르기
4. 자동으로 모든 `.js` 파일 업데이트됨

#### 방법 B: 수동 업데이트

아래 7개 파일에서 `API_BASE_URL` 찾아서 새 URL로 변경:
- `frontend/main.js`
- `frontend/dashboard.js`
- `frontend/project.js`
- `frontend/shot.js`
- `frontend/profile.js`
- `frontend/admin.js`
- `frontend/admin-project-deletion.js`

**변경 전**:
```javascript
const API_BASE_URL = "https://unscrupulous-kimbra-headstrong.ngrok-free.dev";
```

**변경 후**:
```javascript
const API_BASE_URL = "https://xxxxx-xxxxx-xxxxx.ngrok-free.dev"; // 새 ngrok URL
```

### 4단계: GitHub에 푸시

```powershell
cd c:\Users\user\dev\QEPipeline

# 변경사항 추가
git add frontend/*.js

# 커밋
git commit -m "Update backend API URL to new ngrok URL"

# 푸시
git push
```

### 5단계: Amplify 재배포 대기

- Git push 시 자동으로 재배포 시작
- 약 2-5분 소요
- Amplify Console에서 배포 진행 상황 확인 가능

### 6단계: 테스트

1. 배포된 프론트엔드 URL 접속
2. 로그인 시도
3. 정상 작동 확인

## 체크리스트

- [ ] ngrok 실행 (`ngrok http 5000`)
- [ ] ngrok URL 복사
- [ ] 프론트엔드 코드 업데이트 (`UPDATE_API_URL.bat` 사용 또는 수동)
- [ ] GitHub에 커밋 및 푸시
- [ ] Amplify 자동 재배포 대기 (2-5분)
- [ ] 배포 완료 후 테스트

## 문제 해결

### 여전히 연결이 안 되는 경우

1. **백엔드 서버 확인**:
   ```powershell
   netstat -ano | findstr :5000
   ```
   - LISTENING 상태여야 함

2. **ngrok 확인**:
   ```powershell
   tasklist | findstr ngrok
   ```
   - ngrok 프로세스가 실행 중이어야 함

3. **ngrok 웹 인터페이스 확인**:
   - 브라우저에서 http://127.0.0.1:4040 접속
   - Forwarding URL 확인

4. **브라우저 콘솔 확인**:
   - F12 → Console 탭
   - 에러 메시지 확인
   - Network 탭에서 API 요청 확인

5. **CORS 확인**:
   - 백엔드 `app.py`에서 `CORS(app, origins="*")` 확인
   - 모든 도메인에서 접근 가능하도록 설정되어 있음

## 장기적인 해결책

ngrok URL이 자주 변경되는 문제를 피하려면:

1. **AWS Lightsail로 백엔드 배포** (권장)
   - 고정 URL 제공
   - 안정적인 서비스
   - 월 $3.5부터

2. **ngrok 고정 도메인** (유료 플랜 필요)
   - ngrok 유료 플랜에서 고정 도메인 사용 가능

준비되셨으면 ngrok부터 시작하세요!

