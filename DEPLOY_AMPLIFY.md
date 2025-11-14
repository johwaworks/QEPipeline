# AWS Amplify로 프론트엔드 배포하기

## 준비사항

1. AWS 계정 (없으면 생성: https://aws.amazon.com)
2. GitHub 계정 (또는 코드 업로드 가능)

---

## 방법 1: Amplify Console (웹 UI) - 가장 쉬움 ⭐

### 1단계: AWS Console 접속

1. https://console.aws.amazon.com 접속
2. 로그인 (없으면 계정 생성)
3. 검색창에 "Amplify" 입력하여 선택

### 2단계: 새 앱 생성

1. **"New app" 버튼 클릭**
2. **"Host web app" 선택**
3. **배포 방법 선택**:
   
   **옵션 A: GitHub/Bitbucket/GitLab 연결** (권장)
   - "GitHub" 선택
   - GitHub 로그인 및 저장소 선택
   - Branch: `main` (또는 `master`)
   
   **옵션 B: 직접 업로드**
   - "Deploy without Git" 선택
   - `frontend` 폴더를 zip으로 압축
   - 압축 파일 업로드

4. **앱 설정**:
   - App name: `qepipeline-frontend`
   - Environment name: `production`
   - Build settings: 
     ```yaml
     version: 1
     frontend:
       phases:
         preBuild:
           commands:
             - echo "No build needed"
         build:
           commands:
             - echo "Static site, no build"
       artifacts:
         baseDirectory: /
         files:
           - '**/*'
       cache:
         paths: []
     ```
   - 또는 "Continue" 클릭 (Amplify가 자동 감지)

5. **"Save and deploy" 클릭**

### 3단계: 배포 완료 대기

- 배포 진행 상황 확인 (약 1-3분 소요)
- 배포 완료 후 URL 자동 생성:
  - 예: `https://main.xxxxx.amplify.app`

### 4단계: 환경 변수 설정 (API URL)

1. 앱 선택 → "Environment variables"
2. "Manage variables" 클릭
3. 추가:
   - Key: `REACT_APP_API_URL` (또는 프론트엔드에서 사용하는 이름)
   - Value: 백엔드 URL (예: ngrok URL 또는 Lightsail URL)
4. "Save" 클릭
5. "Redeploy this version" 클릭

### 5단계: 커스텀 도메인 추가 (선택)

1. 앱 선택 → "Domain management"
2. "Add domain" 클릭
3. 도메인 입력 (예: `yourapp.com`)
4. DNS 설정 안내 따르기
5. SSL 인증서 자동 생성 (약 1-2시간 소요)

---

## 방법 2: Amplify CLI

### 1단계: Amplify CLI 설치

```powershell
# Node.js 설치 확인
node --version

# Amplify CLI 설치
npm install -g @aws-amplify/cli
```

### 2단계: Amplify 설정

```powershell
# Amplify 설정
amplify configure

# AWS 계정 로그인
# 리전 선택 (예: ap-northeast-2 - 서울)
# IAM 사용자 생성 (자동)
```

### 3단계: 프로젝트 초기화

```powershell
cd c:\Users\user\dev\QEPipeline\frontend

# Amplify 프로젝트 초기화
amplify init

# 프로젝트 이름: qepipeline-frontend
# Environment: production
# Default editor: Visual Studio Code (또는 다른 편집기)
# App type: javascript
# Framework: none (정적 파일)
# Source directory: .
# Build directory: .
# Start command: (비워둠)
```

### 4단계: 호스팅 추가

```powershell
amplify add hosting

# Hosting with: Amplify Hosting
# Type: Manual deployment (또는 CI/CD)
```

### 5단계: 배포

```powershell
amplify publish

# 또는
amplify push
```

### 6단계: 환경 변수 설정

```powershell
# 환경 변수 추가
amplify env add
# 또는 Console에서 직접 설정
```

---

## 프론트엔드 코드 수정 필요사항

### API URL을 환경 변수로 변경

현재 코드:
```javascript
const API_BASE_URL = "https://unscrupulous-kimbra-headstrong.ngrok-free.dev";
```

변경:
```javascript
// Amplify 환경 변수 사용
const API_BASE_URL = process.env.REACT_APP_API_URL || "https://unscrupulous-kimbra-headstrong.ngrok-free.dev";
```

또는 환경별 설정:
```javascript
// 프로덕션
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? "https://your-backend-url.com"
  : "https://unscrupulous-kimbra-headstrong.ngrok-free.dev";
```

---

## 주의사항

1. **CORS 설정**: 백엔드에서 Amplify 도메인 허용 필요
2. **환경 변수**: 민감한 정보는 환경 변수로 관리
3. **빌드 설정**: 정적 파일이므로 빌드 단계 없음
4. **캐시**: CloudFront CDN 캐시 고려

---

## 비용

- **무료 티어**: 월 5GB 전송, 15GB 저장
- **초과 시**: 약 $0.15/GB
- **예상 비용**: 사용량이 적으면 무료 또는 $1-5/월

---

## 문제 해결

### 배포 실패 시
1. Build logs 확인
2. 환경 변수 확인
3. 파일 경로 확인

### CORS 에러
- 백엔드에서 Amplify 도메인 허용:
  ```python
  CORS(app, origins=["https://yourapp.amplify.app"])
  ```

---

## 다음 단계

1. Amplify 배포 완료
2. 백엔드 배포 (Lightsail 또는 다른 방법)
3. API URL 업데이트
4. 테스트

