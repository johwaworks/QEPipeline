# ngrok Authtoken 오류 해결 방법

## 문제
제공하신 토큰 `6LADIAZHNZIUJR4Q3Q3BCIGMYL6UXQAN`은 ngrok authtoken 형식이 아닙니다.

## 해결 방법

### 1. 올바른 Authtoken 찾기

1. https://dashboard.ngrok.com/get-started/your-authtoken 에 접속
2. 로그인 후 대시보드에서 **"Your Authtoken"** 섹션 확인
3. 올바른 authtoken은 다음과 같은 형식입니다:
   - 보통 `2`로 시작하는 긴 문자열
   - 예: `2abc123def456ghi789jkl012mno345pqr678stu901vwx234yz_5A6B7C8D9E0F1G2H3I4J5K6L7M8N9O0P1Q2R3S4T5U6V7W8X9Y0Z`

### 2. Authtoken 복사 및 설정

올바른 authtoken을 복사한 후:

```powershell
ngrok config add-authtoken YOUR_ACTUAL_AUTHTOKEN
```

### 3. 확인

설정이 완료되면:
```powershell
ngrok config check
```

또는 바로 터널을 시작해보세요:
```powershell
ngrok http 5000
```

## 대안: 환경 변수로 설정

또는 환경 변수로 직접 설정할 수도 있습니다:

```powershell
$env:NGROK_AUTHTOKEN="YOUR_ACTUAL_AUTHTOKEN"
ngrok http 5000
```

## 참고

- ngrok authtoken은 계정당 하나만 존재합니다
- 토큰은 대시보드에서만 확인 가능합니다
- 토큰을 잃어버렸다면 대시보드에서 재생성 가능합니다

