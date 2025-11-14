# 프론트엔드 공유 가이드

## 압축 파일 생성 방법

1. **`PACKAGE_FRONTEND.bat` 파일을 더블클릭**
   - 프론트엔드 폴더가 자동으로 zip 파일로 압축됩니다
   - 압축 파일 위치: `QEPipeline_Frontend.zip` (프로젝트 루트 폴더)

2. **또는 수동으로 압축**:
   - `frontend` 폴더 전체 선택
   - 우클릭 → "압축" 또는 "Send to → Compressed folder"

## 다른 사람에게 전달할 내용

### 1. 파일 전달
- `QEPipeline_Frontend.zip` 파일 공유

### 2. 사용 방법 안내

받은 사람이 해야 할 일:

1. **압축 파일 다운로드 및 압축 해제**
   - `QEPipeline_Frontend.zip` 다운로드
   - 압축 해제 (예: `C:\Users\username\QEPipeline_Frontend\`)

2. **브라우저로 열기**
   - 압축 해제한 폴더에서 `index.html` 파일을 브라우저로 열기
   - 또는 더블클릭

3. **또는 로컬 서버 실행** (권장)
   ```powershell
   cd C:\Users\username\QEPipeline_Frontend
   python -m http.server 8000
   ```
   - 브라우저에서 `http://localhost:8000` 접속

4. **중요: API URL 확인**
   - 모든 JavaScript 파일의 `API_BASE_URL`이 다음으로 설정되어 있는지 확인:
   ```
   https://unscrupulous-kimbra-headstrong.ngrok-free.dev
   ```

### 3. 백엔드 URL이 변경된 경우

만약 백엔드 ngrok URL이 변경되면:
- 모든 프론트엔드 파일의 `API_BASE_URL`을 새 URL로 변경해야 합니다
- 변경할 파일:
  - `dashboard.js`
  - `project.js`
  - `shot.js`
  - `main.js`
  - `profile.js`
  - `admin.js`
  - `admin-project-deletion.js`

## 주의사항

⚠️ **중요**:
- 백엔드 ngrok URL이 변경되면 프론트엔드 코드도 업데이트해야 합니다
- ngrok을 재시작하면 URL이 변경될 수 있습니다 (무료 플랜)
- 백엔드 서버와 ngrok이 실행 중이어야 합니다

## 문제 해결

### 로그인이 안 되는 경우:
1. 백엔드 서버가 실행 중인지 확인
2. ngrok이 실행 중인지 확인
3. 브라우저 콘솔(F12)에서 에러 메시지 확인
4. API URL이 올바른지 확인

### 파일을 열었는데 동작하지 않는 경우:
1. 로컬 서버로 실행해보기 (HTTP 서버)
2. 브라우저 콘솔에서 CORS 에러 확인
3. API URL 확인

