# Git을 이용한 AWS Amplify 배포 가이드

## 준비 완료 ✅

- ✅ `.gitignore` 파일 생성
- ✅ `README.md` 파일 생성
- ✅ `amplify.yml` 설정 파일 준비

---

## 1단계: Git 저장소 초기화

### Git이 설치되어 있는지 확인

```powershell
git --version
```

설치되어 있지 않다면: https://git-scm.com/download/win

### Git 저장소 초기화

```powershell
cd c:\Users\user\dev\QEPipeline
git init
```

---

## 2단계: 파일 추가 및 첫 커밋

### 모든 파일 추가

```powershell
git add .
```

### 첫 커밋

```powershell
git commit -m "Initial commit - QEPipeline project"
```

---

## 3단계: GitHub 저장소 생성

### 웹에서 생성

1. **GitHub 접속**: https://github.com
2. **로그인** (계정이 없으면 생성)
3. **새 저장소 생성**:
   - 우측 상단 "+" 아이콘 → "New repository"
   - Repository name: `QEPipeline` (또는 원하는 이름)
   - Description: "VFX Project Management System" (선택)
   - Public 또는 Private 선택
   - ⚠️ **"Initialize this repository with a README" 체크하지 말 것** (이미 README.md 있음)
   - ⚠️ **"Add .gitignore" 선택하지 말 것** (이미 있음)
4. **"Create repository" 클릭**

### 저장소 URL 복사

생성된 페이지에서 HTTPS URL 복사 (예: `https://github.com/YOUR_USERNAME/QEPipeline.git`)

---

## 4단계: GitHub에 코드 푸시

### 원격 저장소 연결

```powershell
# YOUR_USERNAME과 저장소 이름을 실제 값으로 변경
git remote add origin https://github.com/YOUR_USERNAME/QEPipeline.git
```

### 브랜치 이름 변경 (필요 시)

```powershell
git branch -M main
```

### 코드 푸시

```powershell
git push -u origin main
```

GitHub 로그인 정보 입력 요청 시:
- Username: GitHub 사용자명
- Password: Personal Access Token (PAT) 사용 필요
  - GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
  - "Generate new token" → "repo" 권한 선택 → 토큰 생성 후 복사
  - Password 대신 토큰 사용

---

## 5단계: AWS Amplify에서 GitHub 연동

### AWS Console 접속

1. https://console.aws.amazon.com 접속
2. 로그인 (계정이 없으면 생성)

### Amplify 서비스 선택

1. 상단 검색창에 "**Amplify**" 입력
2. "**AWS Amplify**" 서비스 클릭

### 새 앱 생성

1. 왼쪽 상단 "**New app**" 버튼 클릭
2. "**Host web app**" 선택

### GitHub 연결

1. **"GitHub"** 선택
2. "**Authorize AWS Amplify**" 버튼 클릭
   - GitHub 로그인 화면으로 이동
   - GitHub 계정으로 로그인
   - AWS Amplify 앱에 권한 부여 승인
3. 권한 승인 후 AWS Console로 돌아옴

### 저장소 선택

1. Repository: **"QEPipeline"** 선택
2. Branch: **"main"** 선택
3. "**Next**" 클릭

### 빌드 설정

1. **"App name"**: `qepipeline-frontend` (기본값 또는 원하는 이름)
2. **"Environment name"**: `production` (기본값)
3. **Build settings**:
   - Amplify가 자동으로 `amplify.yml` 파일을 감지합니다
   - 또는 "Edit" 버튼으로 수동 설정:
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
4. **"Advanced settings"** (선택):
   - Environment variables 추가 가능 (나중에 API URL 설정 시 사용)
5. "**Save and deploy**" 클릭

### 배포 완료 대기

1. 배포 진행 상황 확인
   - "Deploying" 상태로 표시
   - 약 2-5분 소요
2. 배포 완료 후:
   - "Successfully deployed" 메시지 확인
   - **URL 자동 생성** (예: `https://main.xxxxx.amplify.app`)
   - 이 URL을 복사하세요!

---

## 6단계: 자동 배포 확인

### Git Push 시 자동 배포

이제 Git에 푸시할 때마다 자동으로 재배포됩니다:

```powershell
# 코드 수정 후
git add .
git commit -m "Update frontend"
git push

# Amplify Console에서 자동 배포 시작됨
```

### Pull Request 프리뷰 (선택)

- Pull Request 생성 시 프리뷰 배포 URL 자동 생성
- Amplify Console → "Branch management"에서 설정 가능

---

## 7단계: 환경 변수 설정 (나중에)

백엔드 URL을 환경 변수로 관리하려면:

1. Amplify Console → 앱 선택
2. 왼쪽 메뉴: "**Environment variables**"
3. "**Manage variables**" 클릭
4. 환경 변수 추가:
   - Key: `REACT_APP_API_URL`
   - Value: 백엔드 URL
5. "**Save**" 클릭
6. 프론트엔드 코드 수정 필요 (JavaScript에서 환경 변수 읽기)

---

## 문제 해결

### Git Push 실패 시

1. **Personal Access Token 확인**:
   - GitHub Settings → Developer settings → Personal access tokens
   - "repo" 권한이 있는 토큰 사용

2. **원격 저장소 확인**:
   ```powershell
   git remote -v
   ```

3. **강제 푸시 (주의!)**:
   ```powershell
   git push -u origin main --force
   ```

### Amplify 배포 실패 시

1. **Build logs 확인**:
   - Amplify Console → 앱 선택 → "Build history"
   - 로그 확인하여 에러 찾기

2. **amplify.yml 파일 확인**:
   - 파일이 올바른 위치에 있는지 확인 (`frontend/amplify.yml` 또는 루트)

3. **파일 경로 확인**:
   - `index.html`이 올바른 위치에 있는지 확인

### GitHub 연결 실패 시

1. Amplify Console에서 GitHub 연결 해제 후 재연결
2. GitHub에서 AWS Amplify 앱 권한 확인:
   - GitHub Settings → Applications → Authorized OAuth Apps

---

## 체크리스트

- [ ] Git 저장소 초기화 (`git init`)
- [ ] 첫 커밋 (`git commit`)
- [ ] GitHub 저장소 생성
- [ ] GitHub에 원격 저장소 연결 (`git remote add origin`)
- [ ] 코드 푸시 (`git push`)
- [ ] AWS Amplify Console 접속
- [ ] GitHub 연결 및 권한 승인
- [ ] 저장소 및 브랜치 선택
- [ ] 빌드 설정 확인
- [ ] 배포 시작
- [ ] 배포 완료 대기 (2-5분)
- [ ] 생성된 URL 확인 및 테스트

---

## 다음 단계

1. ✅ 프론트엔드 배포 완료
2. ⏭️ 백엔드 배포 (Lightsail 또는 EC2)
3. ⏭️ API URL 업데이트
4. ⏭️ 커스텀 도메인 연결 (선택)

준비되셨으면 아래 명령어를 실행하여 시작하세요!

