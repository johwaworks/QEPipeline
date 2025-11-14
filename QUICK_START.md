# 빠른 시작 가이드

## ✅ 완료된 작업

1. Git 저장소 초기화 완료
2. 첫 커밋 완료
3. `.gitignore` 파일 생성
4. `README.md` 파일 생성

---

## 다음 단계

### 1. GitHub 저장소 생성

1. **GitHub 접속**: https://github.com
2. 로그인 (계정이 없으면 생성)
3. 우측 상단 "+" → "New repository"
4. Repository name: `QEPipeline`
5. Public 또는 Private 선택
6. ⚠️ **"Initialize this repository with README" 체크하지 말 것**
7. "Create repository" 클릭

### 2. GitHub URL 복사

생성된 페이지에서 HTTPS URL 복사:
```
https://github.com/YOUR_USERNAME/QEPipeline.git
```

### 3. GitHub에 푸시

아래 명령어를 실행하세요 (YOUR_USERNAME을 실제 사용자명으로 변경):

```powershell
cd c:\Users\user\dev\QEPipeline

# 원격 저장소 연결 (URL을 복사한 값으로 변경)
git remote add origin https://github.com/YOUR_USERNAME/QEPipeline.git

# 브랜치 이름 확인/변경
git branch -M main

# 코드 푸시
git push -u origin main
```

**참고**: GitHub 로그인 시:
- Username: GitHub 사용자명
- Password: **Personal Access Token** 사용 (일반 비밀번호 아님)
  - GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
  - "Generate new token" → "repo" 권한 선택 → 생성 후 복사하여 사용

### 4. AWS Amplify 배포

1. **AWS Console 접속**: https://console.aws.amazon.com
2. 검색창에 "Amplify" 입력
3. "New app" → "Host web app"
4. **"GitHub"** 선택
5. "Authorize AWS Amplify" → GitHub 권한 승인
6. Repository: `QEPipeline` 선택
7. Branch: `main` 선택
8. "Save and deploy" 클릭

---

## 상세 가이드

더 자세한 내용은 `GIT_DEPLOY_GUIDE.md` 파일을 참고하세요.

