# 도메인 설정 가이드

## 옵션 1: Vercel (프론트엔드) + ngrok (백엔드) - **가장 쉬움** ⭐

### 장점
- 완전 무료
- 실제 도메인 제공 (예: `yourapp.vercel.app`)
- 자동 HTTPS
- Git 연동으로 자동 배포
- 매우 간단한 설정

### 설정 방법

1. **Vercel 계정 생성**
   - https://vercel.com 접속
   - GitHub 계정으로 로그인 (또는 이메일)

2. **프로젝트 배포**
   - Vercel 대시보드 → "Add New Project"
   - GitHub 저장소 연결 (또는 직접 업로드)
   - Root Directory: `frontend`
   - Build Command: 없음 (정적 파일)
   - Output Directory: `.`
   - Deploy 클릭

3. **커스텀 도메인 추가** (선택)
   - 프로젝트 Settings → Domains
   - 원하는 도메인 입력
   - DNS 설정 안내 따르기

### 비용: 무료

---

## 옵션 2: Netlify (프론트엔드) + ngrok (백엔드)

### 장점
- 완전 무료
- 실제 도메인 제공 (예: `yourapp.netlify.app`)
- 자동 HTTPS
- 드래그 앤 드롭 배포 가능

### 설정 방법

1. **Netlify 계정 생성**
   - https://netlify.com 접속

2. **프로젝트 배포**
   - 대시보드 → "Add new site" → "Deploy manually"
   - `frontend` 폴더를 드래그 앤 드롭
   - 또는 GitHub 연동

3. **커스텀 도메인 추가** (선택)
   - Site settings → Domain management
   - 원하는 도메인 입력

### 비용: 무료

---

## 옵션 3: 클라우드 서버 (AWS, Google Cloud, Azure 등)

### 장점
- 완전한 제어
- 프론트엔드 + 백엔드 모두 같은 서버
- 실제 도메인 연결

### 단점
- 비용 발생 가능 (무료 티어 제한적)
- 설정이 복잡
- 서버 관리 필요

### 추천: Railway, Render (간단함)

**Railway (https://railway.app)**:
- 무료 티어 제공
- GitHub 연동
- 자동 배포
- 도메인 제공

**Render (https://render.com)**:
- 무료 티어 제공
- 자동 HTTPS
- 도메인 제공

### 비용: 무료 티어 ~ $5/월

---

## 옵션 4: 실제 도메인 구매 + 클라우드 호스팅

### 단계

1. **도메인 구매**
   - Namecheap, GoDaddy, Cloudflare 등
   - 비용: $10-15/년

2. **호스팅 선택**
   - Vercel/Netlify (프론트엔드) - 무료
   - Railway/Render (백엔드) - 무료~$5/월
   - AWS/GCP (전체) - 유료

3. **DNS 설정**
   - 도메인 제공자의 DNS 설정에서
   - A 레코드 또는 CNAME 추가

### 비용: $10-15/년 (도메인) + 호스팅 비용

---

## 추천: Vercel + ngrok (프론트엔드만 도메인)

**이유**:
- ✅ 가장 쉬움
- ✅ 완전 무료
- ✅ 자동 HTTPS
- ✅ 실제 도메인 (`.vercel.app` 또는 커스텀)
- ✅ Git 연동으로 자동 업데이트

**백엔드는 ngrok으로 유지**:
- ngrok 무료 플랜으로 충분
- 또는 백엔드도 Railway/Render에 배포

---

## 다음 단계

어떤 옵션을 선택하시겠습니까?

1. **Vercel (프론트엔드) + ngrok (백엔드)** - 추천 ⭐
2. **Netlify (프론트엔드) + ngrok (백엔드)**
3. **Railway/Render (프론트엔드 + 백엔드 전체)**
4. **실제 도메인 구매 + 클라우드 호스팅**

선택하시면 상세한 설정 가이드를 제공하겠습니다.

