document.addEventListener('DOMContentLoaded', () => {
    const navItems = document.querySelectorAll('.timeline li');
    const articleContainer = document.getElementById('article_container');
    const skeleton = document.getElementById('skeleton');
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.querySelector('.sidebar-wrapper');
    const overlay = document.getElementById('mobileOverlay');

    // ── Skeleton loader management ──
    function showSkeleton() {
        if(skeleton) {
            skeleton.classList.remove('hidden');
            skeleton.style.display = 'flex';
        }
        if(articleContainer) {
            articleContainer.innerHTML = '';
        }
    }

    function hideSkeleton() {
        if(skeleton) {
            skeleton.classList.add('hidden');
            setTimeout(() => { skeleton.style.display = 'none'; }, 300);
        }
    }

    // ── Article Loading (SPA) ──
    function loadArticle(url, articleId) {
        showSkeleton();
        
        try {
            // Read from pre-compiled data.js
            let htmlContent = window.articleData ? window.articleData[articleId] : null;
            
            if (!htmlContent) {
                throw new Error('Article not found in data.js');
            }
            
            if(articleContainer) {
                articleContainer.innerHTML = htmlContent;
                
                // Fix WeChat lazy-loaded images and backgrounds
                const lazyBgs = articleContainer.querySelectorAll('[data-lazy-bgimg]');
                lazyBgs.forEach(el => {
                    const bgUrl = el.getAttribute('data-lazy-bgimg');
                    if (bgUrl) {
                        el.style.backgroundImage = `url('${bgUrl}')`;
                    }
                });
                
                const lazyImgs = articleContainer.querySelectorAll('img[data-src]');
                lazyImgs.forEach(img => {
                    img.src = img.getAttribute('data-src');
                });
                
                // Execute any scripts (if any)
                const scripts = articleContainer.querySelectorAll('script');
                scripts.forEach(oldScript => {
                    const newScript = document.createElement('script');
                    Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
                    newScript.appendChild(document.createTextNode(oldScript.innerHTML));
                    oldScript.parentNode.replaceChild(newScript, oldScript);
                });

                articleContainer.scrollTo(0, 0);
            }
            hideSkeleton();
        } catch (error) {
            console.error('Error loading article:', error);
            if(articleContainer) {
                articleContainer.innerHTML = '<div style="padding: 40px; text-align: center;">加载失败，请尝试刷新网页或检查网络。</div>';
            }
            hideSkeleton();
        }
    }

    // ── Navigation click handler ──
    document.querySelectorAll('.timeline a').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Update active state
            navItems.forEach(item => item.classList.remove('active'));
            this.parentElement.classList.add('active');

            const url = this.getAttribute('href');
            
            // Update URL hash for deep linking
            const articleId = this.getAttribute('data-article');
            if (articleId) {
                history.replaceState(null, '', '#' + articleId);
            }

            loadArticle(url, articleId);

            // Close mobile menu if open
            if (sidebar && sidebar.classList.contains('open')) {
                closeMobileMenu();
            }
        });
    });

    // ── URL Hash routing (deep link support) ──
    function loadFromHash() {
        const rawHash = window.location.hash.slice(1);
        const hash = rawHash ? decodeURIComponent(rawHash) : '';
        let target = null;
        
        if (hash) {
            target = document.querySelector(`.timeline a[data-article="${hash}"]`);
        }
        
        // Fallback to first article if no hash or invalid hash
        if (!target) {
            target = document.querySelector('.timeline a');
        }

        if (target) {
            navItems.forEach(item => item.classList.remove('active'));
            target.parentElement.classList.add('active');
            
            // Update hash if we fell back to default
            if (!hash) {
                const articleId = target.getAttribute('data-article');
                history.replaceState(null, '', '#' + articleId);
            }
            
            loadArticle(target.getAttribute('href'), target.getAttribute('data-article'));
        }
    }

    loadFromHash();
    window.addEventListener('hashchange', loadFromHash);

    // ── Mobile menu ──
    function closeMobileMenu() {
        menuToggle.classList.remove('open');
        sidebar.classList.remove('open');
        overlay.classList.remove('visible');
        setTimeout(() => { overlay.style.display = 'none'; }, 300);
    }

    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            const isOpen = sidebar.classList.contains('open');
            if (isOpen) {
                closeMobileMenu();
            } else {
                menuToggle.classList.add('open');
                sidebar.classList.add('open');
                overlay.style.display = 'block';
                requestAnimationFrame(() => overlay.classList.add('visible'));
            }
        });
    }

    if (overlay) {
        overlay.addEventListener('click', closeMobileMenu);
    }
});
