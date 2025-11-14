# 다음 단계: GitHub 저장소 생성 및 푸시

## ✅ 완료된 작업

1. ✅ Git 사용자 정보 설정 (johwaworks / sssseeeewwwwaaaa@gmail.com)
2. ✅ 첫 커밋 완료 (64개 파일)
3. ✅ 브랜치 이름 변경: main

---

## 다음 단계: GitHub 저장소 생성

### 1단계: GitHub에서 저장소 생성

1. **GitHub 접속**: https://github.com
2. **로그인** (계정: johwaworks)
3. **새 저장소 생성**:
   - 우측 상단 "+" 아이콘 클릭 → "New repository"
   - Repository name: `QEPipeline` (또는 원하는 이름)
   - Description: "VFX Project Management System" (선택)
   - Public 또는 Private 선택
   - ⚠️ **중요**: "Initialize this repository with README" 체크하지 말 것
   - ⚠️ **중요**: "Add .gitignore" 선택하지 말 것
   - ⚠️ **중요**: "Choose a license" 선택하지 말 것
4. **"Create repository" 클릭**

### 2단계: 저장소 URL 복사

생성된 페이지에서 HTTPS URL을 복사하세요:
```
https://github.com/johwaworks/QEPipeline.git
```

### 3단계: GitHub에 코드 푸시

아래 명령어를 실행하세요:

```powershell
cd c:\Users\user\dev\QEPipeline

# 원격 저장소 연결 (URL이 다르면 변경)
git remote add origin https://github.com/johwaworks/QEPipeline.git

# 코드 푸시
git push -u origin main
```

### 4단계: GitHub 로그인

프롬프트가 나타나면:

1. **Username**: `johwaworks` 입력
2. **Password**: ⚠️ **일반 비밀번호가 아닙니다!**
   - **Personal Access Token (PAT)** 사용 필요

#### Personal Access Token 생성:

1. GitHub → 우측 상단 프로필 아이콘 → "Settings"
2. 왼쪽 메뉴 하단: "Developer settings"
3. "Personal access tokens" → "Tokens (classic)"
4. "Generate new token" → "Generate new token (classic)"
5. Note: `AWS Amplify Deploy`
6. Expiration: 원하는 기간 선택 (예: 90 days)
7. Scopes: **`repo`** 체크박스 선택 (전체 권한)
8. 하단 "Generate token" 클릭
9. **생성된 토큰을 복사** (다시 볼 수 없으므로 반드시 복사!)
   - 예: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
10. Password 입력 프롬프트에서 이 토큰을 사용

---

## 5단계: AWS Amplify 배포

GitHub에 푸시 완료 후:

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

1. Repository: **"QEPipeline"** 선택
2. Branch: **"main"** 선택
3. "**Next**" 클릭

### 빌드 설정

1. **App name**: `qepipeline-frontend` (기본값)
2. **Environment name**: `production` (기본값)
3. **Build settings**: 
   - Amplify가 자동으로 `amplify.yml` 파일을 감지합니다
   - 또는 "Edit" 버튼으로 수동 확인:
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

1. 배포 진행 상황 확인 (약 2-5분)
2. 배포 완료 후 URL 확인 (예: `https://main.xxxxx.amplify.app`)

---

## 완료!

모든 단계를 완료하면:
- ✅ 코드가 GitHub에 저장됨
- ✅ 프론트엔드가 AWS Amplify에 배포됨
- ✅ 실제 도메인 URL 생성됨
- ✅ Git push 시 자동 재배포됨

---

## 문제 해결

### Git Push 실패 시

**Personal Access Token 확인**:
- GitHub → Settings → Developer settings → Personal access tokens
- "repo" 권한이 있는 토큰 사용

**원격 저장소 확인**:
```powershell
git remote -v
```

### Amplify 배포 실패 시

1. **Build logs 확인**:
   - Amplify Console → 앱 선택 → "Build history"
   - 최신 빌드 클릭 → "View logs"

2. **파일 경로 확인**:
   - `frontend/index.html` 파일이 있는지 확인

준비되셨으면 GitHub에서 저장소를 생성하세요!

