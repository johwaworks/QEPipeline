# 프론트엔드 공유 방법

## 문제
ngrok 무료 플랜은 하나의 터널만 사용 가능합니다.
- 백엔드: `ngrok http 5000` (이미 실행 중)
- 프론트엔드: 같은 URL을 사용할 수 없음

## 해결 방법

### 방법 1: 프론트엔드 파일 직접 공유 (가장 간단)

1. **프론트엔드 폴더 전체를 zip으로 압축**:
   - `c:\Users\user\dev\QEPipeline\frontend` 폴더 전체
   
2. **압축 파일을 다른 사람에게 공유**

3. **다른 사람이 할 일**:
   - 압축 파일 다운로드 및 압축 해제
   - `index.html` 파일을 브라우저로 열기
   - 또는 로컬 HTTP 서버 실행:
     ```powershell
     cd frontend
     python -m http.server 8000
     ```
   - 브라우저에서 `http://localhost:8000` 접속

**장점**: 간단하고 빠름
**단점**: 각 사용자가 파일을 다운로드해야 함

### 방법 2: Cloudflare Tunnel 사용 (무료, 고정 도메인)

1. **Cloudflare 계정 생성** (무료)
2. **cloudflared 설치**:
   ```powershell
   winget install cloudflare.cloudflared
   ```

3. **프론트엔드 터널 실행**:
   ```powershell
   cd c:\Users\user\dev\QEPipeline\frontend
   cloudflared tunnel --url http://localhost:8000
   ```

**장점**: 무료, 고정 도메인 제공
**단점**: 별도 설치 필요

### 방법 3: 프론트엔드를 별도 서버에 배포

- Vercel, Netlify 등에 프론트엔드 배포 (무료)
- 실제 도메인으로 접근 가능

**장점**: 가장 공식적인 방법
**단점**: 설정이 복잡할 수 있음

## 추천

**현재 상황에서는 방법 1 (파일 직접 공유)이 가장 빠르고 간단합니다.**

