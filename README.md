# 이채윤 · Lee Chaeyun

동양화 작가 이채윤의 작품·약력·전시·소식을 관리하는 홈페이지입니다. 공개 화면은 **Cloudflare Pages**, 관리자 API는 **Cloudflare Workers + D1**을 사용합니다. 운영 주소는 https://leechaeyun.pages.dev/ 입니다. 관리자 저장과 자동 배포에는 별도 토큰 설정이 필요합니다.

- [Cloudflare Pages / 관리자 API 배포 안내](docs/DEPLOYMENT.md)
- [관리자 사용 안내](docs/ADMIN_GUIDE.md)

## 바로 실행

Node.js **24 LTS 권장** (최소 22.13). 로컬 실행·테스트·빌드에 외부 npm 패키지 설치가 필요하지 않습니다.

```bash
cd chaeyun_homepage
npm run setup
npm run dev
```

`setup`은 `.env`가 없을 때만 무작위 관리자 비밀번호를 생성합니다. 기존 설정은 덮어쓰지 않습니다. **`.env`의 `ADMIN_PASSWORD`를 열어 확인하거나 16자 이상의 비밀번호로 변경**하세요. 변경 후 개발 서버를 재시작합니다. 비밀번호는 로그에 출력하지 않습니다.

- 공개 화면: <http://127.0.0.1:4173/>
- 관리자: <http://127.0.0.1:4173/admin/>

개발 서버는 접근 출처를 고정했으므로 `localhost` 대신 위 주소를 사용합니다. 로컬 업로드·게시는 `public/`에 저장되며 GitHub로 자동 전송되지 않습니다. 인증 DB는 Git에서 제외한 `.local/`에 있습니다.

## 구현 기능

| 공개 화면 | 관리자 |
| --- | --- |
| 홈 작품 자동 순환·작품 상세 페이지 | 홈 순서·Works의 같은 연도 내 순서 관리 |
| 연도별 작품 그리드·구분선 | 비밀번호 로그인·로그아웃 |
| 작품 확대·이전·다음·방향키·Esc | 작품 추가·수정·삭제·순서 변경 |
| 작가 소개·작가 노트·약력·CV PDF | JPG·PNG·WebP·TIF·TIFF 업로드·최적화·미리보기 |
| 개인전·단체전 구분과 연도별 전시 기록·소식·연락처 | 전시 사진 여러 장·필수 대표 사진·작품 연결, 작가 사진·약력 PDF 업로드 |
| 모바일 반응형·이미지 대체 텍스트 | 글 편집·게시·충돌 감지 |

가상의 작품·경력을 기입하지 않으며, 관리자가 작품을 등록하고 게시하면 홈과 Works 페이지에 반영됩니다.

TIFF는 관리자 브라우저에서 첫 페이지를 WebP로 변환해 업로드합니다. 원본 파일은 별도로 보관하세요. 변환기는 사이트에 포함되어 외부 CDN이나 이미지 변환 서비스에 접속하지 않습니다. [형식·크기 제한](docs/ADMIN_GUIDE.md)과 [디코더 라이선스](public/vendor/README.md)를 참고하세요.

## 화면 구성

사용자가 제공한 `index.html`과 `style.css`를 바탕으로 상단 5열 메뉴, 흰 바탕, 검정 글자, 파란색 링크 강조를 적용했습니다. 홈은 PC와 모바일 모두 흰 배경 위에 업로드한 작품을 한 점씩 크게 표시하고 자동 순환합니다. 작품을 누르면 상세 페이지로 이동합니다. 데모용 합성 이미지는 사용하지 않으며, 모든 화면에서 작품의 원래 비율을 유지합니다.

| 메뉴 | 경로 | 관리자 데이터 |
| --- | --- | --- |
| Lee Chaeyun | `index.html` | 영문 이름, 작품 자동 순환 |
| 작품 상세 | `work.html?id=작품ID` | 작품 이미지·제목·연도·재료·크기·설명 |
| Works | `works.html` | 연도별 작품·구분선, 확대 보기 |
| Exhibition | `news.html` | 개인전·단체전, Works와 같은 연도별 대표 이미지 그리드, 소식 |
| 전시 상세 | `exhibition.html?id=전시ID` | 전시 정보·사진 갤러리·소개 팝업·연결된 작품 상세 이동 |
| Texts | `texts.html` | 작가 노트와 작업 관련 글 |
| CV | `cv.html` | 작가 소개, 약력, 작가 사진, PDF, 연락처 |

방문객·관리자 페이지는 `style.css`의 공통 글꼴과 흰 배경을 사용합니다. 홈 캐러셀은 `src/home.css`, 콘텐츠 화면은 `src/gallery.css`, 관리자 입력 폼·편집 메뉴·버튼은 `src/admin.css`에서 확장합니다. 관리 메뉴는 홈페이지와 같은 순서의 Works / Exhibition / Texts / CV입니다. 소개·사진·연락처·약력은 CV, 작가 노트는 Texts, 소식은 Exhibition 안에서 편집합니다.

방문객 페이지에서는 남색 붓 커서의 이동 경로에 거친 붓결이 남고 약 2.2초 후 사라집니다. 이 효과는 마우스에서만 동작하며 클릭·스크롤을 가로채지 않습니다. 기기의 동작 줄이기 설정을 사용하면 잔상 효과는 표시하지 않습니다.

왼쪽 하단 팔레트에서 기본 8색 또는 직접 고른 색으로 붓자국을 남길 수 있습니다. 물통을 누르면 현재 붓자국이 지워지고 새 흔적이 생기지 않습니다. 팔레트에서 색을 다시 선택하면 그리기를 재개합니다. 붓끝에도 선택한 색을 표시하며, 색과 물통 상태는 해당 브라우저에 저장되어 페이지를 이동해도 유지됩니다.

## 관리자 API가 별도로 필요한 이유

이 홈페이지의 Pages 배포는 정적 파일만 제공하며 서버 인증은 별도 Worker에서 실행합니다. 프런트엔드에서 `.env` 비밀번호를 비교하면 비밀번호가 공개됩니다. 로컬에서는 Node 서버, 운영에서는 Worker가 비밀번호를 확인하고 GitHub API로 파일을 저장합니다. 토큰·비밀번호는 공개 코드에 포함하지 않습니다.

일반 방문자는 Pages 화면과 Worker의 공개 콘텐츠·이미지를 읽습니다. 편집 API는 비밀번호 인증이 필요합니다. 콘텐츠는 게시 후 새로고침하면 반영되며, 코드 변경 때만 자동 배포합니다. 무료 플랜 범위에서 운영하도록 설계했으며 무제한 무료는 아닙니다. 한도와 설정은 [배포 안내](docs/DEPLOYMENT.md)를 확인하세요.

## 검증과 빌드

```bash
npm run check
npm run build
```

`dist/`가 정적 홈페이지 배포 결과입니다. GitHub Actions는 JavaScript 구문 검사와 콘텐츠·파일 경로 검증을 포함한 빌드 후 Pages에 배포합니다. 테스트 코드와 초기 디자인 분석 자료는 로컬에만 보관하며 저장소에는 포함하지 않습니다.

관리자 저장과 자동 배포는 배포 안내의 GitHub 및 Cloudflare 토큰 등록을 완료해야 작동합니다.

## 구조

```text
index.html                     홈
work.html                      작품 상세 (id 쿼리)
exhibition.html                전시 상세 (id 쿼리)
works.html / texts.html         작품 / 작가 글
news.html / cv.html             소식·전시 / 약력
style.css                      사용자가 제공한 디자인 기반 공통 스타일
admin/index.html               관리자 페이지
src/                           화면 JS와 CSS
public/content/site.json       공개 콘텐츠
public/uploads/                업로드 후 생성되는 이미지·PDF
server/                        인증·GitHub API·입력 검증
migrations/0001_auth.sql        세션·로그인 시도 테이블
scripts/                       로컬 서버·설정·빌드
wrangler.jsonc                 Cloudflare 설정
.github/workflows/pages.yml    main 변경 시 자동 배포
.env.example                   로컬 설정 예시
```

## 운영 주소

- 방문객: https://leechaeyun.pages.dev/
- 관리자: https://leechaeyun.pages.dev/admin/
- 관리자 API: https://chaeyun-admin.chaeyun-homepage.workers.dev

관리자 Worker에는 `ADMIN_PASSWORD`·`GITHUB_TOKEN`, GitHub Actions에는 `CLOUDFLARE_API_TOKEN`이 필요합니다. [배포 안내](docs/DEPLOYMENT.md)를 참고하세요.
