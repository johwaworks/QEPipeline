# 시간 동기화 기능 가이드

## 개요

서버 시간과 클라이언트 시간을 동기화하여 모든 사용자가 동일한 시간 기준을 사용하도록 합니다.

## 구현 내용

### 1. 백엔드 API 엔드포인트

**`GET /api/time`**
- 서버의 현재 시간(UTC)을 반환
- 응답 형식:
  ```json
  {
    "server_time": "2024-01-01T12:00:00.000000+00:00",
    "timestamp": 1704110400.0,
    "timezone": "UTC"
  }
  ```

### 2. 프론트엔드 시간 동기화 모듈

**`frontend/time-sync.js`**

주요 기능:
- 서버 시간과 클라이언트 시간 동기화
- 자동 주기적 동기화 (기본 5분마다)
- 동기화된 시간 반환 함수
- 날짜 포맷팅 함수
- 상대 시간 표시 함수 (예: "2 minutes ago")

### 3. 사용 방법

#### 기본 사용

```javascript
// 시간 동기화 초기화 (페이지 로드 시)
await window.TimeSync.initTimeSync();

// 동기화된 현재 시간 가져오기
const syncedTime = window.TimeSync.getSyncedTime();
console.log(syncedTime); // Date 객체

// 동기화된 타임스탬프 가져오기
const timestamp = window.TimeSync.getSyncedTimestamp();
console.log(timestamp); // number (milliseconds)

// 날짜 포맷팅
const formatted = window.TimeSync.formatSyncedDate(new Date());
console.log(formatted); // "Jan 1, 2024, 12:00:00 PM UTC"

// 상대 시간 표시
const timeAgo = window.TimeSync.getTimeAgo(someDate);
console.log(timeAgo); // "2 minutes ago"
```

#### 수동 동기화

```javascript
// 수동으로 시간 동기화
await window.TimeSync.syncTime();

// 동기화 상태 확인
const status = window.TimeSync.getSyncStatus();
console.log(status);
// {
//   offset: 5000,        // 클라이언트와 서버의 시간 차이 (ms)
//   lastSync: 1234567890, // 마지막 동기화 시간
//   isSynced: true,     // 동기화 여부
//   syncing: false      // 현재 동기화 중인지
// }
```

## 적용된 페이지

- ✅ `dashboard.html` - 시간 동기화 모듈 추가됨

## 다른 페이지에 적용하기

### 1. HTML 파일에 스크립트 추가

```html
<script src="time-sync.js"></script>
<script src="your-script.js"></script>
```

### 2. JavaScript 파일에서 초기화

```javascript
// 페이지 로드 시
document.addEventListener("DOMContentLoaded", async () => {
  // 시간 동기화 초기화
  if (window.TimeSync) {
    await window.TimeSync.initTimeSync();
  }
  
  // 나머지 초기화 코드...
});
```

### 3. API_BASE_URL 설정 (필요한 경우)

```javascript
// 메인 스크립트에서
const API_BASE_URL = "https://your-api-url.com";
window.API_BASE_URL = API_BASE_URL; // time-sync.js에서 사용
```

## 예제: 날짜 표시 업데이트

기존 날짜 표시 함수를 동기화된 시간으로 업데이트:

```javascript
// 기존 코드
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
}

// 업데이트된 코드 (동기화된 시간 사용)
function formatDate(dateString) {
  if (window.TimeSync && window.TimeSync.isTimeSynced()) {
    return window.TimeSync.formatSyncedDate(dateString);
  }
  // Fallback to local time if not synced
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
}
```

## 동기화 주기 조정

기본 동기화 주기는 5분입니다. 변경하려면:

```javascript
// 1분마다 동기화
await window.TimeSync.initTimeSync(60 * 1000);

// 10분마다 동기화
await window.TimeSync.initTimeSync(10 * 60 * 1000);
```

## 주의사항

1. **초기 동기화**: 페이지 로드 시 첫 동기화가 완료될 때까지 약간의 지연이 있을 수 있습니다.
2. **네트워크 오류**: 네트워크 오류 시 마지막으로 알려진 오프셋을 사용합니다.
3. **시간대**: 서버 시간은 UTC로 반환되며, 클라이언트에서 로컬 시간대로 변환할 수 있습니다.

## 테스트

1. 브라우저 콘솔에서 확인:
   ```javascript
   window.TimeSync.getSyncStatus()
   ```

2. 동기화된 시간 확인:
   ```javascript
   window.TimeSync.getSyncedTime()
   ```

3. 수동 동기화 테스트:
   ```javascript
   await window.TimeSync.syncTime()
   ```

## 다음 단계

다른 페이지들에도 시간 동기화를 적용하려면:
- `project.html`
- `shot.html`
- `profile.html`
- `admin.html`
- 등등...

각 페이지의 HTML에 `time-sync.js` 스크립트를 추가하고 초기화 함수를 호출하세요.

