# AWS Amplify 배포 단계별 가이드

## 준비 완료 ✅

- ✅ `amplify.yml` 파일 생성 완료
- ✅ 프론트엔드 파일 준비 완료

---

## 배포 방법 선택

### 방법 1: 직접 업로드 (가장 빠름) ⭐

**소요 시간**: 약 5분

1. AWS Console 접속
2. Amplify 선택
3. 프로젝트 업로드
4. 배포 완료

---

### 방법 2: GitHub 연동 (자동 배포)

**소요 시간**: 약 10분

1. GitHub에 코드 업로드
2. AWS Console에서 GitHub 연결
3. 자동 배포 설정
4. Git push 시 자동 배포

---

## 방법 1: 직접 업로드 배포

### 1단계: AWS Console 접속

1. 브라우저에서 https://console.aws.amazon.com 접속
2. AWS 계정으로 로그인
   - 계정이 없으면 "Create an AWS account" 클릭하여 생성
   - 결제 정보 입력 필요 (무료 티어 사용 시 요금 안 나감)

### 2단계: Amplify 서비스 선택

1. AWS Console 상단 검색창에 "**Amplify**" 입력
2. "**AWS Amplify**" 서비스 클릭
3. Amplify Console 화면이 열림

### 3단계: 새 앱 생성

1. 왼쪽 상단 "**New app**" 버튼 클릭
2. "**Host web app**" 선택

### 4단계: 배포 방법 선택

1. **"Deploy without Git"** 선택 (직접 업로드)
2. App name: `qepipeline-frontend` 입력
3. Environment name: `production` (기본값)
4. "**Drag and drop your files**" 영역에:
   - `c:\Users\user\dev\QEPipeline\frontend` 폴더의 **모든 파일** 선택
   - 또는 zip 파일로 압축 후 업로드
5. "**Save and deploy**" 클릭

### 5단계: 배포 완료 대기

1. 배포 진행 상황 확인
   - "Deploying" 상태로 표시
   - 약 1-3분 소요
2. 배포 완료 후:
   - "Successfully deployed" 메시지 확인
   - **URL 자동 생성** (예: `https://main.xxxxx.amplify.app`)
   - 이 URL을 복사하세요!

### 6단계: 테스트

1. 생성된 URL로 접속
2. 로그인 페이지가 정상적으로 나타나는지 확인
3. 브라우저 콘솔(F12)에서 에러 확인

---

## 방법 2: GitHub 연동 배포

### 1단계: GitHub 저장소 생성

1. GitHub (https://github.com) 접속 및 로그인
2. "New repository" 클릭
3. Repository name: `QEPipeline` (또는 원하는 이름)
4. Public 또는 Private 선택
5. "Create repository" 클릭

### 2단계: 코드 업로드

**옵션 A: GitHub Desktop 사용**

1. GitHub Desktop 설치 (https://desktop.github.com)
2. "File" → "Clone repository" → URL 입력
3. `frontend` 폴더 내용 복사
4. Commit & Push

**옵션 B: Git 명령어 사용**

```powershell
cd c:\Users\user\dev\QEPipeline

# Git 초기화 (아직 안 했다면)
git init

# GitHub 원격 저장소 추가
git remote add origin https://github.com/YOUR_USERNAME/QEPipeline.git

# 파일 추가
git add frontend/

# 커밋
git commit -m "Initial commit - frontend files"

# 푸시
git branch -M main
git push -u origin main
```

### 3단계: AWS Amplify에서 GitHub 연결

1. AWS Console → Amplify
2. "New app" → "Host web app"
3. **"GitHub"** 선택
4. GitHub 로그인 및 권한 승인
5. Repository: `QEPipeline` 선택
6. Branch: `main` 선택
7. Build settings: 기본값 사용 (또는 amplify.yml 자동 감지)
8. "Save and deploy" 클릭

### 4단계: 자동 배포

- Git push 시 자동으로 재배포됩니다
- Pull Request 생성 시 프리뷰 배포 가능

---

## 중요: 백엔드 URL 설정

현재 프론트엔드는 ngrok URL을 사용 중입니다:

```
https://unscrupulous-kimbra-headstrong.ngrok-free.dev
```

### 나중에 백엔드를 AWS에 배포하면:

1. **환경 변수 추가** (Amplify Console):
   - App settings → Environment variables
   - Key: `REACT_APP_API_URL`
   - Value: 백엔드 URL (예: Lightsail URL)

2. **프론트엔드 코드 수정** 필요:
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

## 비용

- **무료 티어**: 
  - 월 5GB 전송
  - 15GB 저장
  - **사용량이 적으면 완전 무료**
- **초과 시**: 약 $0.15/GB
- **예상**: 대부분의 경우 무료

---

## 문제 해결

### 배포 실패 시

1. **Build logs 확인**:
   - Amplify Console → 앱 선택 → "Build history"
   - 로그 확인하여 에러 찾기

2. **파일 경로 확인**:
   - `index.html`이 루트에 있는지 확인

3. **파일 크기 확인**:
   - 단일 파일 50MB 제한

### CORS 에러 발생 시

- 백엔드에서 Amplify 도메인 허용 필요:
```python
CORS(app, origins=[
    "https://yourapp.amplify.app",
    "https://unscrupulous-kimbra-headstrong.ngrok-free.dev"
])
```

---

## 다음 단계

1. ✅ 프론트엔드 배포 완료
2. ⏭️ 백엔드 배포 (Lightsail 또는 EC2)
3. ⏭️ API URL 업데이트
4. ⏭️ 테스트 및 최적화

---

## 빠른 체크리스트

- [ ] AWS 계정 생성/로그인
- [ ] Amplify Console 접속
- [ ] "New app" → "Host web app" 클릭
- [ ] "Deploy without Git" 선택
- [ ] frontend 폴더 파일 업로드
- [ ] "Save and deploy" 클릭
- [ ] 배포 완료 대기 (1-3분)
- [ ] 생성된 URL 확인 및 테스트

준비되셨으면 AWS Console로 이동하여 배포를 시작하세요!

