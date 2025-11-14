# AWS Amplify 배포 가이드

## ✅ 완료된 작업

1. ✅ Git 사용자 정보 설정
2. ✅ Git 커밋 완료
3. ✅ GitHub 저장소 생성
4. ✅ GitHub에 코드 푸시 완료

---

## 다음 단계: AWS Amplify 배포

### 1단계: AWS 계정 생성 (없는 경우)

1. **AWS 접속**: https://aws.amazon.com
2. **"Create an AWS Account"** 클릭
3. 계정 정보 입력
4. 결제 정보 입력 (무료 티어 사용 시 요금 안 나감)
5. 전화번호 확인
6. 플랜 선택: **"Basic (Free)"** 선택
7. 계정 생성 완료

### 2단계: AWS Console 접속

1. https://console.aws.amazon.com 접속
2. 방금 만든 AWS 계정으로 로그인
3. Region 선택: `Asia Pacific (Seoul) - ap-northeast-2` (또는 원하는 지역)

### 3단계: Amplify 서비스 선택

1. 상단 검색창에 "**Amplify**" 입력
2. "**AWS Amplify**" 서비스 클릭
3. Amplify Console 화면이 열림

### 4단계: 새 앱 생성

1. 왼쪽 상단 "**New app**" 버튼 클릭
2. "**Host web app**" 선택

### 5단계: GitHub 연결

1. **"GitHub"** 선택
2. "**Authorize AWS Amplify**" 버튼 클릭
   - GitHub 로그인 화면으로 이동
   - GitHub 계정 (`johwaworks`)으로 로그인
   - AWS Amplify 앱에 권한 부여
   - "**Authorize aws-amplify-console**" 버튼 클릭
   - 또는 "**Authorize**" 버튼 클릭
3. 권한 승인 후 AWS Console로 자동 돌아옴

### 6단계: 저장소 및 브랜치 선택

1. Repository: **"QEPipeline"** 선택 (방금 푸시한 저장소)
2. Branch: **"main"** 선택
3. "**Next**" 클릭

### 7단계: 빌드 설정

1. **App name**: `qepipeline-frontend` (기본값 또는 원하는 이름)
2. **Environment name**: `production` (기본값)
3. **Build settings**: 
   - Amplify가 자동으로 `amplify.yml` 파일을 감지합니다
   - 감지되지 않으면 "Edit" 버튼 클릭:
   ```yaml
   version: 1
   frontend:
     phases:
       preBuild:
         commands:
           - echo "No build needed for static files"
       build:
         commands:
           - echo "Static site deployment - no build step required"
     artifacts:
       baseDirectory: /
       files:
         - '**/*'
     cache:
       paths: []
   ```
   - 또는 "Edit" → "frontend" 섹션에서:
     - Pre-build commands: 비워둠
     - Build commands: 비워둠
     - Artifacts directory: `/` (루트)
     - Base directory: `/` (루트)
4. "**Save and deploy**" 클릭

### 8단계: 배포 완료 대기

1. 배포 진행 상황 확인
   - "Provisioning" → "Building" → "Deploying" → "Verify"
   - 약 2-5분 소요
2. 각 단계를 클릭하여 로그 확인 가능
3. 배포 완료 후:
   - "Successfully deployed" 메시지 확인
   - **URL 자동 생성** (예: `https://main.xxxxx.amplify.app`)
   - 이 URL을 복사하세요!

### 9단계: 테스트

1. 생성된 URL로 접속
2. 로그인 페이지가 정상적으로 나타나는지 확인
3. 브라우저 콘솔(F12)에서 에러 확인
4. 로그인 시도하여 백엔드 연결 확인

---

## 중요: 백엔드 URL 설정

현재 프론트엔드는 ngrok URL을 사용 중입니다:
```
https://unscrupulous-kimbra-headstrong.ngrok-free.dev
```

### 나중에 백엔드를 AWS에 배포하면:

1. **환경 변수 추가** (Amplify Console):
   - 앱 선택 → 왼쪽 메뉴 "Environment variables"
   - "Manage variables" 클릭
   - Key: `REACT_APP_API_URL`
   - Value: 백엔드 URL (예: Lightsail URL)
   - "Save" 클릭
   - "Redeploy this version" 클릭

2. **프론트엔드 코드 수정 필요**:
   - 모든 `.js` 파일에서 `API_BASE_URL`을 환경 변수로 변경

---

## 커스텀 도메인 추가 (선택)

1. Amplify Console → 앱 선택
2. 왼쪽 메뉴: "Domain management"
3. "Add domain" 클릭
4. 도메인 입력 (예: `yourapp.com`)
5. DNS 설정 안내 따르기
6. SSL 인증서 자동 생성 (약 1-2시간 소요)

---

## 자동 배포 확인

이제 Git에 푸시할 때마다 자동으로 재배포됩니다:

```powershell
cd c:\Users\user\dev\QEPipeline

# 코드 수정 후
git add .
git commit -m "Update frontend"
git push

# Amplify Console에서 자동으로 배포가 시작됩니다!
```

---

## 문제 해결

### GitHub 연결 실패 시

1. Amplify Console에서 GitHub 연결 해제 후 재연결
2. GitHub에서 AWS Amplify 앱 권한 확인:
   - GitHub → Settings → Applications → Authorized OAuth Apps
   - "AWS Amplify" 확인

### 배포 실패 시

1. **Build logs 확인**:
   - Amplify Console → 앱 선택 → "Build history"
   - 최신 빌드 클릭 → "View logs"
   - 에러 메시지 확인

2. **파일 경로 확인**:
   - `frontend/index.html` 파일이 올바른 위치에 있는지 확인
   - `amplify.yml` 파일이 프로젝트 루트 또는 `frontend` 폴더에 있는지 확인

3. **빌드 설정 확인**:
   - Build settings에서 Base directory와 Artifacts directory 확인
   - 정적 파일이므로 빌드 명령은 필요 없음

### CORS 에러 발생 시

백엔드에서 Amplify 도메인 허용 필요:
```python
CORS(app, origins=[
    "https://yourapp.amplify.app",
    "https://unscrupulous-kimbra-headstrong.ngrok-free.dev"
])
```

---

## 비용

- **무료 티어**: 
  - 월 5GB 전송
  - 15GB 저장
  - **사용량이 적으면 완전 무료**
- **초과 시**: 약 $0.15/GB
- **예상**: 대부분의 경우 무료

---

## 체크리스트

- [ ] AWS 계정 생성 (없는 경우)
- [ ] AWS Console 접속
- [ ] Amplify 서비스 선택
- [ ] "New app" → "Host web app" 클릭
- [ ] "GitHub" 선택
- [ ] "Authorize AWS Amplify" → GitHub 권한 승인
- [ ] Repository: "QEPipeline" 선택
- [ ] Branch: "main" 선택
- [ ] 빌드 설정 확인 (amplify.yml 자동 감지)
- [ ] "Save and deploy" 클릭
- [ ] 배포 완료 대기 (2-5분)
- [ ] 생성된 URL 확인 및 테스트

---

## 완료!

모든 단계를 완료하면:
- ✅ 프론트엔드가 AWS Amplify에 배포됨
- ✅ 실제 도메인 URL 생성됨 (예: `https://main.xxxxx.amplify.app`)
- ✅ Git push 시 자동 재배포됨
- ✅ HTTPS 자동 적용됨
- ✅ CDN 자동 적용됨

준비되셨으면 AWS Console로 이동하여 배포를 시작하세요!

