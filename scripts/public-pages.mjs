// Explicit static routes shared by the local server and GitHub Pages build.
export const publicPages = {
  'index.html': '',
  'works.html': 'Works',
  'work.html': 'Work',
  'texts.html': 'Texts',
  'news.html': 'Exhibition',
  'exhibition.html': 'Exhibition',
  'cv.html': 'CV'
};
export const publicRootFiles = new Set([...Object.keys(publicPages), 'style.css']);
