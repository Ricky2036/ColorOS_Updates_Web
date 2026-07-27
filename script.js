
document.addEventListener('DOMContentLoaded', () => {
    const sections = document.querySelectorAll('.card');
    const navItems = document.querySelectorAll('.timeline li');
    
    // Smooth scroll for nav links
    document.querySelectorAll('.timeline a').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const targetEl = document.getElementById(targetId);
            if(targetEl) {
                // Instantly update active class on click
                navItems.forEach(item => item.classList.remove('active'));
                this.parentElement.classList.add('active');
                
                window.scrollTo({
                    top: targetEl.getBoundingClientRect().top + window.scrollY - 40,
                    behavior: 'smooth'
                });
            }
        });
    });

    // Scroll event listener for more accurate highlighting on tall sections
    window.addEventListener('scroll', () => {
        let currentSectionId = '';
        let minDistance = Infinity;
        
        sections.forEach(section => {
            const rect = section.getBoundingClientRect();
            // We want the section that is closest to the top of the viewport (e.g., top is near 100px)
            // If the section spans across the top of the viewport (rect.top <= 100 and rect.bottom >= 100), it's the active one.
            if (rect.top <= 150 && rect.bottom >= 150) {
                currentSectionId = section.getAttribute('id');
            }
        });
        
        if (currentSectionId) {
            let activeItem = null;
            navItems.forEach(item => {
                item.classList.remove('active');
                if (item.querySelector('a').getAttribute('href') === '#' + currentSectionId) {
                    item.classList.add('active');
                    activeItem = item;
                }
            });
            
            if (activeItem) {
                const sidebar = document.querySelector('.sidebar');
                const itemTop = activeItem.offsetTop;
                const sidebarScrollTop = sidebar.scrollTop;
                const sidebarHeight = sidebar.clientHeight;
                
                if (itemTop < sidebarScrollTop || itemTop > sidebarScrollTop + sidebarHeight - 50) {
                    sidebar.scrollTo({
                        top: itemTop - sidebarHeight / 2 + 20,
                        behavior: 'smooth'
                    });
                }
            }
        }
    });

    // Fix WeChat interactive images that rely on data-lazy-bgimg
    document.querySelectorAll('[data-lazy-bgimg]').forEach(el => {
        el.style.backgroundImage = `url('${el.getAttribute('data-lazy-bgimg')}')`;
    });
});
