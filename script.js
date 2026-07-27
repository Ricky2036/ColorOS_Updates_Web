
document.addEventListener('DOMContentLoaded', () => {
    const navItems = document.querySelectorAll('.timeline li');
    
    // Add active class to clicked nav item
    document.querySelectorAll('.timeline a').forEach(anchor => {
        anchor.addEventListener('click', function() {
            navItems.forEach(item => item.classList.remove('active'));
            this.parentElement.classList.add('active');
        });
    });
});
