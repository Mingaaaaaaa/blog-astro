(function () {
    const html = document.documentElement;
    function setTheme(theme) {
        if (theme === 'dark') {
            html.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
        } else {
            html.removeAttribute('data-theme');
            localStorage.removeItem('theme');
        }
    }
    function changeIcons(theme) {
        const iconMoon = document.querySelector('.icon-moon');
        const iconSun = document.querySelector('.icon-sun');
        const iconGithub = document.querySelector('.icon-github');
        const iconGithubDark = document.querySelector('.icon-github-dark');
        const avatar = document.querySelector('.avatar');
        if (theme === 'dark') {
            iconMoon.style.display = 'none';
            iconSun.style.display = 'block';
            iconGithub.style.display = 'none';
            iconGithubDark.style.display = 'block';
            avatar.style.filter = 'brightness(0.9)';
        } else {
            iconGithub.style.display = 'block';
            iconGithubDark.style.display = 'none';
            iconMoon.style.display = 'block';
            iconSun.style.display = 'none';
            avatar.style.filter = 'brightness(1)';
        }
    }
    const initNewPageTheme = () => {
        if (localStorage.getItem('theme')) {
            setTheme(localStorage.getItem('theme'));
            requestAnimationFrame(() => {
                changeIcons(localStorage.getItem('theme'));
            }
            );
        } else {
            setTheme('light');
        }
    }
    initNewPageTheme();
    document.addEventListener("astro:after-swap", initNewPageTheme);

    window.toggleTheme = function () {
        console.log('Toggling theme');
        if (html.getAttribute('data-theme') === 'dark') {
            setTheme('light');

            changeIcons('light');
        } else {
            setTheme('dark');
            changeIcons('dark');
        }
    }
    console.log('Theme script loaded');
})()