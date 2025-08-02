(function () {
    const html = document.documentElement;
    function setTheme(theme) {
        if (theme === 'dark') {
            html.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
        } else {
            html.setAttribute('data-theme', 'light');
            localStorage.removeItem('theme');
        }
    }

    const initNewPageTheme = () => {
        if (localStorage.getItem('theme')) {
            setTheme(localStorage.getItem('theme'));
        }
    }
    initNewPageTheme();
    document.addEventListener("astro:after-swap", initNewPageTheme);
    window.toggleTheme = function () {
        if (html.getAttribute('data-theme') === 'dark') {
            setTheme('light');
        } else {
            setTheme('dark');
        }
    }
})()