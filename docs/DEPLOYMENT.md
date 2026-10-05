# GitHub Pages와 관리자 API 배포

저장소: [UngSangYoon/chaeyun_homepage](https://github.com/UngSangYoon/chaeyun_homepage), 기본 브랜치 `main`. 이번 작업은 요청에 따라 로컬 구현과 안내까지이며 원격 배포하지 않았습니다.

## 1. 비용과 계정

공개 GitHub 저장소·기본 `github.io` 주소, **Cloudflare Workers Free + D1 Free**를 사용합니다. 도메인 구매·유료 플랜·R2·결제 서비스는 필요하지 않습니다.

2026-09-20 확인 기준 Workers Free는 일 100,000 요청, D1 Free는 일 5백만 행 읽기·10만 행 쓰기 등의 한도가 있습니다. 한도·정책은 바뀔 수 있으므로 [Workers 제한](https://developers.cloudflare.com/workers/platform/limits/), [Workers 요금](https://developers.cloudflare.com/workers/platform/pricing/), [D1 요금](https://developers.cloudflare.com/d1/platform/pricing/)을 확인하세요. 무료 한도 초과 시 요청이 실패할 수 있습니다. 비용이 필요한 업그레이드를 활성화하지 않습니다.

이미지는 GitHub에 쌓이므로 최적화된 이미지를 사용하고 [GitHub Pages 제한](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)을 따릅니다. 저장소·커밋 이력·업로드 자료는 공개로 취급합니다.

## 2. 로컬 확인과 GitHub 로그인

프로젝트 디렉터리에서:

```bash
npm run setup
npm run check
npm run build
gh auth login -h github.com
gh auth status
```

`UngSangYoon` 계정에 로그인합니다. `.env`는 Git에서 제외됩니다. 비밀번호·토큰을 저장소나 채팅에 붙여 넣지 않습니다.

## 3. Cloudflare 도구와 D1

[Wrangler 설치 안내](https://developers.cloudflare.com/workers/wrangler/install-and-update/)에 따라 배포 시 도구를 추가합니다. 로컬 실행에는 필요하지 않습니다.

```bash
npm ci
npx wrangler login
npx wrangler d1 create chaeyun-admin-auth
```

새 환경에서는 생성 결과의 `database_id`를 `wrangler.jsonc`의 기존 `DB` 항목에 입력합니다. 현재 프로젝트에는 생성한 DB ID가 연결되어 있으므로 같은 계정에서 다시 생성할 필요가 없습니다. 생성 명령이 설정에 새 항목을 자동 추가했다면, 실제 ID를 기존 `binding: "DB"` 항목으로 옮기고 중복 항목은 제거합니다. `migrations_dir: "migrations"`는 유지합니다. 공개 설정은 다음과 같습니다.

```text
SITE_ORIGIN=https://ungsangyoon.github.io
GITHUB_OWNER=UngSangYoon
GITHUB_REPO=chaeyun_homepage
GITHUB_BRANCH=main
```

`SITE_ORIGIN`에는 경로와 마지막 `/`가 없습니다. `/chaeyun_homepage/`를 붙이지 않습니다. 별도 도메인을 사용하면 이 값도 변경합니다.

```bash
npx wrangler d1 migrations apply chaeyun-admin-auth --remote
```

인증 테이블을 생성합니다. 작품 데이터는 D1이 아닌 GitHub의 `public/content/site.json`에 저장합니다. [D1 명령 문서](https://developers.cloudflare.com/d1/wrangler-commands/)

## 4. GitHub 쓰기 토큰

GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens에서 생성합니다.

- Resource owner: `UngSangYoon`
- Repository access: Only select repositories → `chaeyun_homepage`
- Repository permissions: **Contents → Read and write**
- 만료일을 설정하고 갱신 일정을 기록

Workflows 수정 권한이나 모든 저장소 접근 권한은 필요하지 않습니다. API가 `public/`에만 파일을 쓰고 수정 시 SHA를 검사합니다. [Contents API 문서](https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents)

이 구현은 PR 승인 방식이 아니라 `main` 직접 커밋 방식입니다. 브랜치 보호에서 직접 커밋을 금지하면 게시가 실패하므로 저장소 운영 방식에 맞게 확인합니다.

## 5. 운영 Secret과 Worker 배포

```bash
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put GITHUB_TOKEN
npx wrangler deploy
```

명령의 입력 프롬프트에 값을 입력합니다. 비밀번호는 16~256자로 정합니다. 명령줄 인수·`wrangler.jsonc`·Actions 공개 변수에 비밀값을 넣지 않습니다. 최초 Secret 명령에서 Worker 생성을 물으면 `chaeyun-admin` 이름을 확인하고 생성합니다.

로컬 `.env`는 운영에 자동 전달되지 않습니다. 같은 비밀번호를 원하면 Secret에 같은 값을 입력합니다. 비밀번호를 바꾸려면 Secret 명령을 다시 실행하며 기존 세션은 무효화됩니다. [Secrets 문서](https://developers.cloudflare.com/workers/configuration/secrets/)

결과 주소를 보관합니다. 예: `https://chaeyun-admin.<계정서브도메인>.workers.dev`. API 경로는 `/login`, `/content`, `/upload`, `/logout`입니다.

## 6. Pages와 API 주소 연결

GitHub 저장소에서:

1. Settings → Pages → Build and deployment → **Source: GitHub Actions**
2. Settings → Secrets and variables → Actions → **Variables → New repository variable**
3. 이름 `ADMIN_API_URL`, 값은 Worker 주소. 마지막 `/`나 `/login`은 제외합니다.

API 주소는 공개 URL입니다. `.env`에만 입력하면 Actions에 전달되지 않으므로 반드시 저장소 변수에 등록합니다. 주소 없는 배포도 공개 페이지는 열리지만 관리자 로그인은 비활성화됩니다.

변경사항을 확인한 후 커밋·푸시합니다.

```bash
git status --short
git add README.md package.json package-lock.json .gitignore .env.example index.html works.html work.html exhibition.html texts.html news.html cv.html style.css admin src public server scripts docs migrations wrangler.jsonc .github
git commit -m "Build Lee Chaeyun artist website and secure admin"
git push origin main
```

Wrangler 설치로 생성된 `package-lock.json`도 커밋합니다. `.env`는 추가하지 않습니다. 실제 작품·개인정보가 의도한 공개 자료인지 확인합니다.

워크플로는 검사 → 빌드 → Pages 배포 순서입니다. API 주소만 바꿨다면 Actions → Deploy GitHub Pages → Run workflow로 다시 배포합니다.

## 7. 운영 확인

배포 성공 후:

- 공개: `https://ungsangyoon.github.io/chaeyun_homepage/`
- 관리자: `https://ungsangyoon.github.io/chaeyun_homepage/admin/`

로그인 → 작은 작품 이미지 업로드 → 제목·연도 입력 → 게시 → Actions 완료 → 홈페이지 새로고침을 확인합니다. 소개·약력·모바일·확대 보기·연락처·PDF도 확인합니다.

## 8. 문제 해결

| 상황 | 확인 |
| --- | --- |
| Pages 404 | Source 설정·workflow 성공·저장소 경로 |
| 로그인 버튼 비활성 | `ADMIN_API_URL` 등록 후 재배포 |
| CORS 오류 | Worker Origin과 페이지 Origin 일치 |
| API 503 | 비밀번호 길이·Secret·D1 바인딩 |
| API 500 | 마이그레이션 적용. 필요하면 `npx wrangler tail` |
| API 429 | 15분 후 로그인 재시도 |
| GitHub 저장 실패 | 토큰 만료·권한·저장소·브랜치 보호 |
| 게시 성공인데 화면 그대로 | 저장과 배포는 별개. Actions 결과 확인 |
| 업로드 실패 | 5MB·파일 형식·무료 Worker CPU/요청 한도. 작은 파일로 재시도 |
| 로컬/운영 충돌 | `git pull --rebase` 후 통합, 강제 푸시하지 않음 |

업로드 파일은 항목 삭제 후에도 남으므로 필요하면 따로 정리합니다. Git 이력에서 완전히 지우려면 별도 절차가 필요합니다. Worker가 중단되어도 이미 배포된 공개 홈페이지는 열립니다. `public/`과 Git 이력이 콘텐츠 백업 역할을 합니다.
