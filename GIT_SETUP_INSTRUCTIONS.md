# Git 설정 및 GitHub 푸시 가이드

## ✅ 완료된 작업

1. Git 저장소 초기화 완료 (`git init`)
2. `.gitignore` 파일 생성
3. `README.md` 파일 생성
4. 파일 추가 완료 (`git add .`)

---

## 현재 상태

Git 사용자 정보 설정이 필요합니다.

---

## 1단계: Git 사용자 정보 설정

### 방법 A: 배치 파일 사용 (쉬움)

1. `SETUP_GIT.bat` 파일 더블클릭
2. 이메일 주소 입력 (GitHub 이메일)
3. 사용자 이름 입력 (GitHub 사용자명)

### 방법 B: 명령줄 직접 입력

```powershell
# 이메일 설정 (GitHub 이메일로 변경)
git config --global user.email "your-email@example.com"

# 사용자 이름 설정 (GitHub 사용자명으로 변경)
git config --global user.name "Your Name"
```

---

## 2단계: 첫 커밋

Git 사용자 정보 설정 후:

```powershell
cd c:\Users\user\dev\QEPipeline
git commit -m "Initial commit - QEPipeline project"
```

---

## 3단계: GitHub 저장소 생성

1. **GitHub 접속**: https://github.com
2. 로그인 (계정이 없으면 생성)
3. 우측 상단 "+" 아이콘 클릭 → "New repository"
4. Repository name: `QEPipeline` (또는 원하는 이름)
5. Description: "VFX Project Management System" (선택)
6. Public 또는 Private 선택
7. ⚠️ **중요**: "Initialize this repository with README" 체크하지 말 것
8. ⚠️ **중요**: "Add .gitignore" 선택하지 말 것
9. "Create repository" 클릭

### 저장소 URL 복사

생성된 페이지에서 HTTPS URL을 복사하세요:
```
https://github.com/YOUR_USERNAME/QEPipeline.git
```

---

## 4단계: GitHub에 코드 푸시

### 원격 저장소 연결

```powershell
cd c:\Users\user\dev\QEPipeline

# YOUR_USERNAME과 저장소 이름을 실제 값으로 변경
git remote add origin https://github.com/YOUR_USERNAME/QEPipeline.git
```

### 브랜치 이름 확인/변경

```powershell
# 브랜치 이름 확인
git branch

# main 브랜치로 변경 (필요 시)
git branch -M main
```

### 코드 푸시

```powershell
git push -u origin main
```

### GitHub 로그인

프롬프트가 나타나면:

1. **Username**: GitHub 사용자명 입력
2. **Password**: ⚠️ **일반 비밀번호가 아닙니다!**
   - **Personal Access Token (PAT)** 사용 필요

#### Personal Access Token 생성 방법:

1. GitHub → 우측 상단 프로필 아이콘 → "Settings"
2. 왼쪽 메뉴 하단: "Developer settings"
3. "Personal access tokens" → "Tokens (classic)"
4. "Generate new token" → "Generate new token (classic)"
5. Note: `AWS Amplify Deploy` (설명용)
6. Expiration: 원하는 기간 선택
7. Scopes: **`repo`** 체크 (전체 권한)
8. 하단 "Generate token" 클릭
9. **생성된 토큰을 복사** (다시 볼 수 없으므로 반드시 복사!)
10. Password 입력 시 이 토큰 사용

---

## 5단계: AWS Amplify 배포

### AWS Console 접속

1. https://console.aws.amazon.com 접속
2. 로그인 (계정이 없으면 생성 - 무료 티어)

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
   - AWS Amplify에 권한 부여 → "Authorize aws-amplify-console" 클릭
3. 권한 승인 후 AWS Console로 자동 돌아옴

### 저장소 및 브랜치 선택

1. Repository: **"QEPipeline"** 선택 (방금 만든 저장소)
2. Branch: **"main"** 선택
3. "**Next**" 클릭

### 빌드 설정

1. **App name**: `qepipeline-frontend` (기본값 또는 원하는 이름)
2. **Environment name**: `production` (기본값)
3. **Build settings**: 
   - Amplify가 자동으로 `amplify.yml` 파일을 감지합니다
   - 감지되지 않으면 "Edit" 클릭하여 수동 입력:
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
4. "**Save and deploy**" 클릭

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

이제 Git에 푸시할 때마다 자동으로 재배포됩니다:

```powershell
# 코드 수정 후
git add .
git commit -m "Update frontend"
git push

# Amplify Console에서 자동으로 배포가 시작됩니다!
```

---

## 체크리스트

- [ ] Git 사용자 정보 설정
- [ ] 첫 커밋 완료 (`git commit`)
- [ ] GitHub 저장소 생성
- [ ] Personal Access Token 생성
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

## 문제 해결

### Git 커밋 실패 시

사용자 정보 설정 확인:
```powershell
git config --global user.email
git config --global user.name
```

설정되지 않았다면 다시 설정:
```powershell
git config --global user.email "your-email@example.com"
git config --global user.name "Your Name"
```

### Git Push 실패 시

1. **Personal Access Token 확인**:
   - GitHub → Settings → Developer settings → Personal access tokens
   - "repo" 권한이 있는지 확인

2. **원격 저장소 확인**:
   ```powershell
   git remote -v
   ```

3. **토큰 재사용**: Password 입력 시 생성한 토큰을 정확히 입력

### Amplify 배포 실패 시

1. **Build logs 확인**:
   - Amplify Console → 앱 선택 → "Build history"
   - 최신 빌드 클릭 → "View logs"

2. **파일 경로 확인**:
   - `frontend/index.html` 파일이 있는지 확인

3. **amplify.yml 위치 확인**:
   - 프로젝트 루트 또는 `frontend` 폴더에 있어야 함

---

준비되셨으면 Git 사용자 정보부터 설정하세요!

