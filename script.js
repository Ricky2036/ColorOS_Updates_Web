document.addEventListener('DOMContentLoaded', () => {
    const navItems = document.querySelectorAll('.timeline li');
    const iframe = document.getElementById('content_frame');
    const skeleton = document.getElementById('skeleton');
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.querySelector('.sidebar-wrapper');
    const overlay = document.getElementById('mobileOverlay');

    // ── Skeleton loader management ──
    function showSkeleton() {
        skeleton.classList.remove('hidden');
        skeleton.style.display = 'flex';
    }

    function hideSkeleton() {
        skeleton.classList.add('hidden');
        setTimeout(() => { skeleton.style.display = 'none'; }, 300);
    }

    iframe.addEventListener('load', hideSkeleton);

    // ── Navigation click handler ──
    document.querySelectorAll('.timeline a').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            // Update active state
            navItems.forEach(item => item.classList.remove('active'));
            this.parentElement.classList.add('active');

            // Show skeleton
            showSkeleton();

            // Update URL hash for deep linking
            const articleId = this.getAttribute('data-article');
            if (articleId) {
                history.replaceState(null, '', '#' + articleId);
            }

            // Close mobile menu if open
            if (sidebar && sidebar.classList.contains('open')) {
                closeMobileMenu();
            }
        });
    });

    // ── URL Hash routing (deep link support) ──
    function loadFromHash() {
        const hash = window.location.hash.slice(1);
        if (!hash) return;

        const target = document.querySelector(`.timeline a[data-article="${hash}"]`);
        if (target) {
            navItems.forEach(item => item.classList.remove('active'));
            target.parentElement.classList.add('active');
            showSkeleton();
            iframe.src = target.getAttribute('href');
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
