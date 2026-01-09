import './main.js';
import 'https://cdnjs.cloudflare.com/ajax/libs/scrollama/3.2.0/scrollama.min.js';

const scroller = scrollama();
let article;
let header;
let viewer;
let prior;

const setActive = (el) => {
  prior = document.querySelector('.active');
  if (prior) prior.classList.remove('active');
  el.classList.add('active');
}

const updateViewer = (el) => {

  let viewerContent = el.previousElementSibling;
  while (viewerContent && (!(viewerContent.nodeName === 'IFRAME' || viewerContent.classList.contains('right')))) {
    viewerContent = viewerContent.previousElementSibling;
  }
  if (!viewerContent) return;

  let clone = viewerContent.cloneNode(true);
  clone.querySelector('.shimmer')?.classList.remove('shimmer');
  clone.style.display = 'block';
  if (viewer.firstChild) viewer.removeChild(viewer.firstChild);
  viewer.appendChild(clone);
}

const handleStepEnter = (response) => {
  setActive(response.element);
  updateViewer(response.element);
}

const positionViewer = () => {
  let articleRect = article.getBoundingClientRect();
  let articleWidth = articleRect.width;
  viewer.style.height = (window.innerHeight - header.getBoundingClientRect().bottom - 2) + 'px';
  viewer.style.width = (articleWidth / 2) + 'px';
  viewer.style.right = window.innerWidth - articleRect.right + 'px';
}

const init2col = () => {
  article = document.querySelector('article');
  header = document.querySelector('article > header');
  viewer = document.querySelector('.viewer'); window.addEventListener('scroll', () => positionViewer());
  setTimeout(() => positionViewer(), 100);
  scroller
    .setup({
      step: '.post-content p.text',
      offset: 0.05,
      debug: false
    })
    .onStepEnter(handleStepEnter);
}

init2col();
