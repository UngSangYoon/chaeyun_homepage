# Cloudflare Pages와 관리자 API 배포

저장소: UngSangYoon/chaeyun_homepage · 기본 브랜치: main

- 홈페이지: https://leechaeyun.pages.dev/
- 관리자: https://leechaeyun.pages.dev/admin/
- 관리자 API: https://chaeyun-admin.chaeyun-homepage.workers.dev

홈페이지는 Cloudflare Pages의 Direct Upload 프로젝트 `leechaeyun`으로 배포합니다. GitHub Pages 설정은 사용하지 않습니다. Direct Upload 프로젝트는 Cloudflare의 Git 통합 방식으로 전환할 수 없으므로, 이 저장소의 GitHub Actions로 자동 배포합니다. [공식 안내](https://developers.cloudflare.com/pages/get-started/direct-upload/)

## 관리자 서버

`wrangler.jsonc`의 Worker 이름은 `chaeyun-admin`입니다. D1 인증 저장소가 연결되어 있으며 다음 공개 설정을 사용합니다.

```text
SITE_ORIGIN=https://leechaeyun.pages.dev
GITHUB_OWNER=UngSangYoon
GITHUB_REPO=chaeyun_homepage
GITHUB_BRANCH=main
```

관리자 API는 비밀번호 인증 후 GitHub의 `public/` 파일을 저장합니다. 홈페이지 주소가 변경되면 `SITE_ORIGIN`도 변경해 다시 배포합니다. 이 값은 경로 없이 출처만 입력합니다.

```bash
npm ci
npx wrangler login
npx wrangler d1 migrations apply chaeyun-admin-auth --remote
npx wrangler deploy
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put GITHUB_TOKEN
```

`ADMIN_PASSWORD`는 16~256자입니다. 로컬 `.env` 변경은 운영에 자동 반영되지 않으므로 변경 시 Secret도 갱신합니다. 기존 세션은 무효화됩니다. 현재 운영 비밀번호는 배포 당시 로컬 `.env`의 값을 등록했습니다.

`GITHUB_TOKEN`은 GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens에서 생성합니다.

- Resource owner: UngSangYoon
- Repository access: chaeyun_homepage만 선택
- Repository permissions: Contents → Read and write

토큰은 위 Secret 입력 프롬프트에 입력하며 채팅·코드·공개 변수에 넣지 않습니다. 기본 브랜치에 직접 커밋하는 구현이므로 직접 쓰기를 금지하는 브랜치 보호 정책이 있으면 저장에 실패합니다.

## 자동 배포 설정

관리자에서 게시하면 GitHub에 백업 커밋되고 D1의 공개 콘텐츠가 갱신됩니다. 방문객은 `/public/content`에서 최신 내용을 읽으므로 새로고침 시 반영됩니다. 업로드 이미지·PDF는 `/public/uploads/...`에서 제공하며 파일마다 고유 경로를 사용해 캐시합니다. 콘텐츠·업로드 커밋은 자동 배포를 실행하지 않습니다. 코드 변경만 `.github/workflows/pages.yml`에서 배포합니다. 다음 토큰이 필요합니다.

1. Cloudflare 계정에서 API Token을 생성합니다. 해당 계정의 **Cloudflare Pages → Edit** 권한만 부여합니다.
2. GitHub 저장소 Settings → Secrets and variables → Actions → Secrets → New repository secret을 엽니다.
3. 이름 `CLOUDFLARE_API_TOKEN`, 값은 생성한 Cloudflare 토큰을 입력합니다.
4. 새 워크플로가 푸시된 뒤 Actions → Deploy Cloudflare Pages → Run workflow를 실행합니다.

계정 ID와 관리자 API 주소는 공개 설정으로 워크플로에 포함됩니다. `ADMIN_API_URL` 저장소 변수와 GitHub Pages 설정은 더 이상 필요하지 않습니다. Cloudflare 로그인 OAuth 토큰을 GitHub에 복사하지 말고 별도 배포용 API Token을 생성합니다.

## 수동 배포

```bash
npm run check
ADMIN_API_URL=https://chaeyun-admin.chaeyun-homepage.workers.dev npm run build
npx wrangler pages deploy dist --project-name leechaeyun --branch main
```

빌드에는 `.env`와 서버 코드를 포함하지 않습니다. Pages 명령이 관리자 Worker용 `wrangler.jsonc`를 무시한다는 경고는 예상된 동작입니다. Worker와 정적 Pages는 별도로 배포합니다.

## 운영 확인

관리자 로그인 → 작품 업로드 → 게시 → 홈페이지 새로고침 순서로 확인합니다. 코드 변경 시에는 GitHub Actions 성공까지 확인합니다. 로그인이 성공해도 `GITHUB_TOKEN`이 없으면 콘텐츠 읽기·저장이 실패합니다. `CLOUDFLARE_API_TOKEN`은 코드 변경 배포에 필요합니다.

| 증상 | 확인 |
| --- | --- |
| 관리자 연결 준비 메시지 | 빌드의 ADMIN_API_URL 및 재배포 |
| 허용되지 않은 요청 출처 | Worker SITE_ORIGIN과 실제 홈페이지 주소 |
| 인증 설정 필요 | ADMIN_PASSWORD 길이 및 D1 테이블 |
| 저장소 연결 미설정 | Worker GITHUB_TOKEN 등록 |
| 저장 후 화면 미변경 | 공개 /public/content 응답 및 새로고침 |
| Cloudflare 10034 | 계정 이메일 인증 |

Cloudflare 무료 플랜의 요청·CPU·D1·Pages 배포 한도가 적용됩니다. [Workers 제한](https://developers.cloudflare.com/workers/platform/limits/), [Pages 제한](https://developers.cloudflare.com/pages/platform/limits/)

## 공개 콘텐츠 저장소

D1의 `published_content` 테이블이 방문객에게 제공할 콘텐츠를 보관합니다. 최초 공개 요청에서 GitHub 콘텐츠로 초기화하며 이후 관리자 게시 시 갱신합니다. `site.json`을 GitHub에서 직접 수정하는 경우 공개 D1 데이터는 자동 갱신되지 않으므로 관리자에서 최신 내용을 불러와 게시해야 합니다. 공개 GET에는 로그인이 필요 없지만, 저장·업로드·관리자 콘텐츠 조회에는 기존 인증이 적용됩니다.
