# AWS 배포 가이드

## AWS 배포 옵션

### 옵션 1: AWS Amplify (프론트엔드) + EC2/Lightsail (백엔드) - **추천** ⭐

**장점**:
- Amplify는 정적 웹사이트 호스팅이 매우 쉬움
- 무료 티어 제공
- 자동 HTTPS, CDN 포함
- 도메인 제공 (예: `yourapp.amplify.app`)
- Git 연동으로 자동 배포

**비용**: 
- Amplify: 무료 (월 5GB 전송, 15GB 저장)
- EC2/Lightsail: $3.5-5/월 (최소 사양)

---

### 옵션 2: S3 + CloudFront (프론트엔드) + EC2/Lightsail (백엔드)

**장점**:
- S3는 매우 저렴한 정적 호스팅
- CloudFront로 전 세계 CDN
- 확장성 좋음

**단점**:
- 설정이 조금 복잡
- 도메인은 직접 구매 필요

**비용**:
- S3: 거의 무료 (월 1GB 저장)
- CloudFront: 첫 1TB 무료/월
- EC2/Lightsail: $3.5-5/월

---

### 옵션 3: Lightsail 전체 스택

**장점**:
- 프론트엔드 + 백엔드 모두 하나의 서버
- 매우 간단
- 예측 가능한 비용

**단점**:
- 프론트엔드가 정적 파일이므로 S3가 더 효율적
- 서버 관리 필요

**비용**: $3.5-10/월

---

## 추천: AWS Amplify + Lightsail

**이유**:
- ✅ Amplify는 프론트엔드 배포가 매우 쉬움
- ✅ Lightsail은 백엔드 배포가 간단하고 저렴
- ✅ 무료 티어로 시작 가능
- ✅ 나중에 확장 용이

---

## 배포 단계

### 1단계: AWS 계정 생성
1. https://aws.amazon.com 접속
2. 계정 생성 (무료 티어 12개월)
3. 결제 정보 입력 (무료 티어 사용시 요금 안 나감)

### 2단계: 프론트엔드 배포 (Amplify)

#### 방법 A: Amplify Console (웹 UI)

1. **AWS Console 로그인**
   - https://console.aws.amazon.com

2. **Amplify 서비스 선택**
   - 검색창에 "Amplify" 입력

3. **새 앱 생성**
   - "New app" → "Host web app"
   - GitHub/Bitbucket/GitLab 연결 (또는 "Deploy without Git")
   - 앱 이름: `qepipeline-frontend`
   - Branch: `main` (또는 `master`)
   - Build settings: 기본값 사용 (정적 파일이므로)
   - "Save and deploy"

4. **배포 완료**
   - 자동으로 URL 생성 (예: `yourapp.amplify.app`)
   - 커스텀 도메인 추가 가능

#### 방법 B: Amplify CLI (명령줄)

```bash
# Amplify CLI 설치
npm install -g @aws-amplify/cli

# Amplify 설정
amplify configure

# 프로젝트 초기화
cd frontend
amplify init

# 호스팅 추가
amplify add hosting

# 배포
amplify publish
```

### 3단계: 백엔드 배포 (Lightsail)

1. **Lightsail 인스턴스 생성**
   - AWS Console → Lightsail
   - "Create instance"
   - Platform: Linux/Unix
   - Blueprint: Ubuntu 또는 Amazon Linux
   - Instance plan: $3.5/월 (최소)
   - Name: `qepipeline-backend`

2. **SSH 접속 및 설정**
   ```bash
   # SSH 접속 (Lightsail Console에서 제공)
   ssh -i your-key.pem ubuntu@your-instance-ip

   # 시스템 업데이트
   sudo apt update && sudo apt upgrade -y

   # Python 설치
   sudo apt install python3 python3-pip -y

   # MongoDB 설치 (또는 MongoDB Atlas 사용 - 무료)
   # 또는 Docker 사용
   ```

3. **애플리케이션 배포**
   ```bash
   # 프로젝트 파일 업로드 (scp 또는 git)
   # 또는 git clone
   git clone your-repo
   cd QEPipeline/backend

   # 의존성 설치
   pip3 install -r requirements.txt

   # 환경 변수 설정
   # MongoDB 연결 정보 등

   # Gunicorn으로 실행
   pip3 install gunicorn
   gunicorn -w 4 -b 0.0.0.0:5000 app:app

   # 또는 systemd 서비스로 등록
   ```

4. **도메인 연결**
   - Lightsail → Networking → Custom domains
   - 도메인 추가 및 DNS 설정

---

### 4단계: 프론트엔드 API URL 변경

백엔드 URL을 Lightsail 도메인으로 변경:
- 모든 JavaScript 파일의 `API_BASE_URL` 수정
- 또는 Amplify 환경 변수 사용

---

## 비용 예상

### 첫 12개월 (Free Tier)
- **Amplify**: 무료 (월 5GB 전송)
- **Lightsail**: $3.5/월 (t3.nano)
- **총**: 약 $3.5/월 (약 $42/년)

### 12개월 이후
- **Amplify**: 약 $1-5/월 (사용량에 따라)
- **Lightsail**: $3.5/월
- **총**: 약 $4.5-8.5/월

---

## 보안 설정

1. **Security Groups 설정**
   - Lightsail: 포트 5000 (또는 80/443) 열기

2. **HTTPS 설정**
   - Lightsail: Load Balancer 사용 (추가 비용)
   - 또는 Cloudflare 무료 (도메인 필요)

3. **환경 변수 관리**
   - AWS Systems Manager Parameter Store 사용
   - 또는 .env 파일 (보안 주의)

---

## 대안: MongoDB Atlas (무료)

MongoDB를 별도 서버에 설치하는 대신 MongoDB Atlas 사용:
- 무료 티어: 512MB 저장공간
- 클러스터 자동 관리
- 백업 포함

---

## 다음 단계

어떤 방식으로 진행하시겠습니까?

1. **Amplify (프론트엔드) + Lightsail (백엔드)** - 추천
2. **S3 + CloudFront (프론트엔드) + Lightsail (백엔드)**
3. **전체 Lightsail** (하나의 서버)

선택하시면 상세한 단계별 가이드를 제공하겠습니다.

