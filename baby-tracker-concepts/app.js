const navLinks = [...document.querySelectorAll(".concept-nav a")];
const sections = [...document.querySelectorAll(".concept-card")];

const setActiveLink = () => {
  const current = sections.find((section) => {
    const box = section.getBoundingClientRect();
    return box.top <= 160 && box.bottom >= 180;
  });

  navLinks.forEach((link) => {
    const isActive = current && link.getAttribute("href") === `#${current.id}`;
    link.classList.toggle("active", Boolean(isActive));
  });
};

window.addEventListener("scroll", setActiveLink, { passive: true });
window.addEventListener("load", setActiveLink);
