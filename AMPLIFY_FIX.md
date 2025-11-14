# Amplify 배포 수정 가이드

## 문제

배포된 링크에 "Welcome - Your app will appear here once you complete your first deployment" 메시지가 표시됨

## 원인

- `amplify.yml` 파일이 `frontend` 폴더에 있었음
- `baseDirectory`가 `/`로 설정되어 있어서 `index.html`을 찾지 못함
- 실제 `index.html`은 `frontend` 폴더에 있음

## 해결

1. ✅ `amplify.yml` 파일을 프로젝트 루트로 이동
2. ✅ `baseDirectory`를 `frontend`로 변경
3. ✅ GitHub에 커밋 및 푸시 완료

## 수정된 amplify.yml

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
    baseDirectory: frontend  # frontend 폴더에서 파일 찾기
    files:
      - '**/*'
  cache:
    paths: []
```

## 다음 단계

1. **Amplify Console에서 자동 재배포 확인**:
   - Git push 시 자동으로 재배포가 시작됩니다
   - Amplify Console → 앱 선택 → "Build history"
   - 최신 빌드가 "Deploying" 상태로 표시됩니다

2. **배포 완료 대기**:
   - 약 2-5분 소요
   - 배포 완료 후 URL 다시 확인

3. **배포 후 확인**:
   - 생성된 URL로 접속
   - 로그인 페이지가 정상적으로 표시되는지 확인

## 수동으로 재배포하는 방법

만약 자동 재배포가 시작되지 않으면:

1. Amplify Console → 앱 선택
2. 왼쪽 메뉴: "Build settings"
3. "Redeploy this version" 클릭

또는

1. Amplify Console → 앱 선택
2. 왼쪽 메뉴: "Build history"
3. 최신 빌드 옆 "Redeploy" 클릭

## 여전히 문제가 발생하는 경우

### Build logs 확인

1. Amplify Console → 앱 선택
2. "Build history" → 최신 빌드 클릭
3. "View logs" 클릭
4. 에러 메시지 확인

### 파일 경로 확인

- `frontend/index.html` 파일이 존재하는지 확인
- `frontend` 폴더에 모든 파일이 있는지 확인

### 빌드 설정 수동 확인

1. Amplify Console → 앱 선택
2. "Build settings" → "Edit"
3. "frontend" 섹션 확인:
   - Base directory: `frontend` (또는 `/`)
   - Artifacts directory: `/` (또는 `frontend`)

## 성공 확인

배포가 성공하면:
- ✅ 로그인 페이지가 표시됨
- ✅ 브라우저 콘솔에 에러가 없음
- ✅ CSS와 JavaScript 파일이 로드됨

