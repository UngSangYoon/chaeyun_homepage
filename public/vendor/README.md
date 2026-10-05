# TIFF decoder

`utif.js` is a self-contained browser ESM bundle of:

- [UTIF 3.1.0](https://github.com/photopea/UTIF.js), MIT; see `UTIF-LICENSE.txt`.
- [pako 1.0.11](https://github.com/nodeca/pako), MIT; see `pako-LICENSE.txt`.

Built with esbuild 0.28.1. The bundle is checked in so local development and GitHub Pages builds do not require an extra package installation or a runtime CDN. It is loaded only by the TIFF conversion worker. TIFF data remains in the administrator's browser until the converted web image is uploaded.

Rebuild from the repository directory (use a temporary dependency directory):

```sh
npm install --prefix /tmp/chaeyun-tiff-vendor --ignore-scripts --no-audit --no-fund --save-exact utif@3.1.0 pako@1.0.11 esbuild@0.28.1
/tmp/chaeyun-tiff-vendor/node_modules/.bin/esbuild /tmp/chaeyun-tiff-vendor/node_modules/utif/UTIF.js --bundle --format=esm --platform=browser --minify --legal-comments=inline --outfile=public/vendor/utif.js
```

Keep both license files with the bundle. Application validation and format limits are in `public/lib/tiff-decode.js`; worker orchestration and canvas conversion are in `src/tiff-worker.js` and `src/image-upload.js`.
