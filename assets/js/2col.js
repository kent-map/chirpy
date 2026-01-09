import 'https://kit.webawesome.com/b30a7b3e07134a02.js';
import 'https://cdnjs.cloudflare.com/ajax/libs/scrollama/3.2.0/scrollama.min.js'
import 'https://cdn.jsdelivr.net/npm/js-md5@0.8.3/src/md5.min.js'
import '{{ "/assets/js/main.js" | relative_url }}';

const scroller = scrollama();
let article;
let header;
let viewer;
let prior;

const setActive = (el) => {
    prior = document.querySelector('.active');
    if (prior) prior.classList.remove('active');
    el.classList.add('active');
};

const makeCarousel = (el) => {
    const carousel = document.createElement('wa-carousel');
    carousel.setAttribute('pagination', '');
    carousel.setAttribute('navigation', '');
    carousel.setAttribute('mouse-dragging', '');
    carousel.setAttribute('loop', '');
    el.querySelectorAll('iframe').forEach((iframe) => {
        const item = document.createElement('wa-carousel-item');
        item.appendChild(iframe);
        carousel.appendChild(item);
    });
    return carousel;
};

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
};

const handleStepEnter = (response) => {
    // console.log('enter', response.element);
    setActive(response.element);
    updateViewer(response.element);
};

const positionViewer = () => {
    let articleRect = article.getBoundingClientRect();
    let articleWidth = articleRect.width;
    // viewer.style.top = header.getBoundingClientRect().bottom - 6 + 'px';
    viewer.style.height = (window.innerHeight - header.getBoundingClientRect().bottom - 2) + 'px';
    viewer.style.width = (articleWidth / 2) + 'px';
    viewer.style.right = window.innerWidth - articleRect.right + 'px';
    // console.log(viewer.style.right, viewer.style.width);
};

const init = () => {
    window.addEventListener('scroll', () => positionViewer());
    article = document.querySelector('article');
    header = document.querySelector('article > header');
    viewer = document.querySelector('.viewer');
    setTimeout(() => positionViewer(), 100);
    scroller
        .setup({
            step: '.post-content p.text',
            offset: 0.1,
            debug: false
        })
        .onStepEnter(handleStepEnter);
};

init();
