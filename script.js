/* ============================================================================
   CityGo (citygo.ge) — ინტერაქტიული ფუნქციონალი
   1. მარჯვენა ტაქსის სქროლ-ეფექტი (Desktop) და კომპაქტური ზოლი (Mobile)
   2. მობილური მენიუ და Header-ის სქროლ-მდგომარეობა
   3. დღისა და ღამის ხილვადობის ფილტრი
   4. FAQ აკორდეონი და პარტნიორობის ღილაკის მიბმა
   5. საკონტაქტო ფორმის ვალიდაცია და შეტყობინება
   ============================================================================ */

(function () {
  'use strict';

  document.documentElement.classList.add('js-ready');

  /* ---- 1. Header-ის სქროლ-მდგომარეობა და მობილური მენიუ ---- */
  const siteHeader = document.getElementById('siteHeader');
  const mobileMenuToggle = document.getElementById('mobileMenuToggle');
  const mobileNav = document.getElementById('mobileNav');

  function setMobileMenu(open) {
    if (!mobileMenuToggle || !mobileNav) return;
    mobileMenuToggle.setAttribute('aria-expanded', String(open));
    mobileMenuToggle.setAttribute('aria-label', open ? 'მენიუს დახურვა' : 'მენიუს გახსნა');
    mobileNav.classList.toggle('is-open', open);
  }

  if (mobileMenuToggle && mobileNav) {
    mobileMenuToggle.addEventListener('click', function () {
      const isOpen = mobileMenuToggle.getAttribute('aria-expanded') === 'true';
      setMobileMenu(!isOpen);
    });

    mobileNav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        setMobileMenu(false);
      });
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        setMobileMenu(false);
      }
    });
  }

  /* ---- 2. ტაქსის სქროლ-ეფექტი (Desktop მარჯვენა ზოლი + Mobile ზედა ზოლი) ---- */
  const desktopTaxi = document.getElementById('desktopTaxi');
  const taxiStops = Array.from(document.querySelectorAll('.taxi-stop'));
  const mobileTaxiFill = document.getElementById('mobileTaxiFill');
  const mobileTaxiIcon = document.getElementById('mobileTaxiIcon');
  const mobileTaxiTrack = mobileTaxiIcon ? mobileTaxiIcon.parentElement : null;

  const trackedSections = taxiStops
    .map(function (stop) {
      const id = stop.getAttribute('data-section');
      const el = id ? document.getElementById(id) : null;
      return el ? { id: id, el: el, stop: stop } : null;
    })
    .filter(Boolean);

  let targetProgress = 0;
  let currentProgress = 0;
  let lastScrollY = window.scrollY || 0;
  let rafId = null;
  let maxScroll = 0;

  function getScrollProgress() {
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (docHeight <= 0) return 0;
    return Math.min(1, Math.max(0, window.scrollY / docHeight));
  }

  // თითოეული სექციისთვის ვითვლით:
  //  scrollPoint — სქროლის პოზიცია, როცა სექცია აქტიური ხდება
  //  laneY       — შესაბამისი გაჩერების ცენტრის Y კოორდინატი გზაზე
  // ტაქსი ამ წერტილებს შორის ინტერპოლირდება, ამიტომ ზუსტად აქტიურ გაჩერებაზე დგება.
  function measureTaxiLayout() {
    maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const probeOffset = window.innerHeight * 0.35;
    const roadTop = desktopTaxi && desktopTaxi.parentElement
      ? desktopTaxi.parentElement.getBoundingClientRect().top
      : 0;
    let prevPoint = 0;

    trackedSections.forEach(function (item, index) {
      let point = index === 0
        ? 0
        : Math.min(maxScroll, Math.max(0, item.el.offsetTop - probeOffset));
      if (point < prevPoint) point = prevPoint;
      item.scrollPoint = point;
      prevPoint = point;

      const rect = item.stop.getBoundingClientRect();
      item.laneY = rect.top - roadTop + rect.height / 2;
    });
  }

  function getLaneY(scrollPos) {
    const count = trackedSections.length;
    if (!count) return null;
    if (scrollPos <= trackedSections[0].scrollPoint) return trackedSections[0].laneY;

    for (let i = 1; i < count; i++) {
      const from = trackedSections[i - 1];
      const to = trackedSections[i];
      if (scrollPos < to.scrollPoint) {
        const span = to.scrollPoint - from.scrollPoint;
        const t = span > 0 ? (scrollPos - from.scrollPoint) / span : 1;
        return from.laneY + (to.laneY - from.laneY) * t;
      }
    }

    return trackedSections[count - 1].laneY;
  }

  function updateHeaderAndStops() {
    const scrollY = window.scrollY || 0;

    if (siteHeader) {
      siteHeader.classList.toggle('is-scrolled', scrollY > 18);
    }

    if (desktopTaxi) {
      if (scrollY < lastScrollY - 2) {
        desktopTaxi.classList.add('is-scrolling-up');
      } else if (scrollY > lastScrollY + 2) {
        desktopTaxi.classList.remove('is-scrolling-up');
      }
    }

    lastScrollY = scrollY;

    // აქტიური სექციის გამოკვეთა გზის წერტილებზე (იგივე წერტილებით, რითაც ტაქსი მოძრაობს)
    let activeId = trackedSections.length ? trackedSections[0].id : null;

    for (let i = 0; i < trackedSections.length; i++) {
      if (scrollY >= trackedSections[i].scrollPoint - 1) {
        activeId = trackedSections[i].id;
      }
    }

    trackedSections.forEach(function (item) {
      item.stop.classList.toggle('is-active', item.id === activeId);
    });
  }

  function renderTaxiPosition(progress) {
    // Desktop: ვერტიკალური გზა მარჯვენა ზოლში
    if (desktopTaxi) {
      const taxiHeight = desktopTaxi.offsetHeight || 84;
      const laneY = getLaneY(progress * maxScroll);
      let y;

      if (laneY !== null) {
        y = laneY - taxiHeight / 2;
      } else {
        const padding = 24;
        const travelDistance = Math.max(0, window.innerHeight - taxiHeight - padding * 2);
        y = padding + travelDistance * progress;
      }

      desktopTaxi.style.transform = 'translate3d(0, ' + y.toFixed(2) + 'px, 0)';
    }

    // Mobile: კომპაქტური ჰორიზონტალური გზა
    if (mobileTaxiFill && mobileTaxiIcon && mobileTaxiTrack) {
      const pct = (progress * 100).toFixed(2) + '%';
      mobileTaxiFill.style.width = pct;
      const iconWidth = mobileTaxiIcon.offsetWidth || 30;
      const maxX = Math.max(0, mobileTaxiTrack.clientWidth - iconWidth);
      const x = maxX * progress;
      mobileTaxiIcon.style.transform = 'translate3d(' + x.toFixed(2) + 'px, -50%, 0)';
    }
  }

  function animateTaxi() {
    const diff = targetProgress - currentProgress;
    currentProgress += diff * 0.16;

    if (Math.abs(diff) < 0.0005) {
      currentProgress = targetProgress;
      renderTaxiPosition(currentProgress);
      rafId = null;
      return;
    }

    renderTaxiPosition(currentProgress);
    rafId = window.requestAnimationFrame(animateTaxi);
  }

  function onScrollOrResize() {
    targetProgress = getScrollProgress();
    updateHeaderAndStops();

    if (!rafId) {
      rafId = window.requestAnimationFrame(animateTaxi);
    }
  }

  function relayoutTaxi() {
    measureTaxiLayout();
    targetProgress = getScrollProgress();
    currentProgress = targetProgress;
    updateHeaderAndStops();
    renderTaxiPosition(currentProgress);
  }

  window.addEventListener('scroll', onScrollOrResize, { passive: true });
  window.addEventListener('resize', function () {
    relayoutTaxi();
    if (window.innerWidth >= 1100) {
      setMobileMenu(false);
    }
  });

  // გვერდის სიმაღლის ცვლილება (შრიფტები, სურათები, FAQ, ფილტრი) -> წერტილების ხელახალი გაზომვა
  const pageWrapper = document.querySelector('.page-wrapper');
  if ('ResizeObserver' in window && pageWrapper) {
    new ResizeObserver(function () {
      measureTaxiLayout();
      onScrollOrResize();
    }).observe(pageWrapper);
  }
  window.addEventListener('load', relayoutTaxi);

  // საწყისი მდგომარეობა ჩატვირთვისას
  relayoutTaxi();

  /* ---- 3. დღისა და ღამის ხილვადობის ფილტრი ---- */
  const tabButtons = document.querySelectorAll('.segmented-tabs .tab-btn');
  const visibilityGrid = document.getElementById('visibilityGrid');
  const visibilityCards = visibilityGrid ? visibilityGrid.querySelectorAll('.showcase-card') : [];

  tabButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      const filter = btn.getAttribute('data-filter');

      tabButtons.forEach(function (other) {
        const active = other === btn;
        other.classList.toggle('is-active', active);
        other.setAttribute('aria-selected', String(active));
      });

      if (visibilityGrid) {
        visibilityGrid.classList.toggle('is-single', filter !== 'all');
      }

      visibilityCards.forEach(function (card) {
        const mode = card.getAttribute('data-mode');
        card.hidden = filter !== 'all' && mode !== filter;
      });
    });
  });

  /* ---- 4. FAQ აკორდეონი ---- */
  const faqQuestions = document.querySelectorAll('.faq-question');

  function setFaqItem(button, open) {
    button.setAttribute('aria-expanded', String(open));
    const answer = button.nextElementSibling;
    if (answer) {
      answer.classList.toggle('is-open', open);
    }
  }

  faqQuestions.forEach(function (button) {
    button.addEventListener('click', function () {
      const expanded = button.getAttribute('aria-expanded') === 'true';

      // დანარჩენი პასუხების დახურვა სუფთა იერისთვის
      faqQuestions.forEach(function (otherBtn) {
        if (otherBtn !== button) {
          setFaqItem(otherBtn, false);
        }
      });

      setFaqItem(button, !expanded);
    });
  });

  /* ---- 5. პარტნიორობის ღილაკი -> ფორმაში ავტომატური არჩევა ---- */
  const partnerCtaBtn = document.getElementById('partnerCtaBtn');
  const topicSelect = document.getElementById('topic');

  if (partnerCtaBtn && topicSelect) {
    partnerCtaBtn.addEventListener('click', function () {
      topicSelect.value = 'partnership';
    });
  }

  /* ---- 6. საკონტაქტო ფორმა (მუშაობს ლოკალურადაც და მზადაა სერვერისთვის) ---- */
  const contactForm = document.getElementById('contactForm');
  const formStatus = document.getElementById('formStatus');

  if (contactForm && formStatus) {
    contactForm.addEventListener('submit', function (event) {
      event.preventDefault();

      const fullName = document.getElementById('fullName');
      const phone = document.getElementById('phone');
      const email = document.getElementById('email');
      const message = document.getElementById('message');

      const requiredFields = [fullName, phone, email, message];
      let hasError = false;

      requiredFields.forEach(function (field) {
        if (!field) return;
        const value = field.value.trim();
        let invalid = value.length === 0;

        if (!invalid && field.type === 'email') {
          invalid = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        }

        field.classList.toggle('is-invalid', invalid);
        if (invalid) {
          hasError = true;
        }
      });

      if (hasError) {
        formStatus.hidden = false;
        formStatus.className = 'form-status is-error';
        formStatus.textContent = 'გთხოვთ შეავსოთ ყველა სავალდებულო ველი (*) და მიუთითოთ სწორი ელ-ფოსტა.';
        return;
      }

      formStatus.hidden = false;
      formStatus.className = 'form-status is-success';
      formStatus.textContent = 'მადლობა, ' + fullName.value.trim() + '! თქვენი მოთხოვნა მიღებულია. CityGo-ს გუნდი მალე დაგიკავშირდებათ.';
      contactForm.reset();
    });

    contactForm.querySelectorAll('input, textarea').forEach(function (field) {
      field.addEventListener('input', function () {
        field.classList.remove('is-invalid');
      });
    });
  }

  /* ---- 7. სქროლზე ელემენტების რბილი გამოჩენა ---- */
  const revealElements = document.querySelectorAll('.reveal');

  if ('IntersectionObserver' in window && revealElements.length) {
    const observer = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -30px 0px' }
    );

    revealElements.forEach(function (el) {
      observer.observe(el);
    });
  } else {
    revealElements.forEach(function (el) {
      el.classList.add('is-visible');
    });
  }

  /* ---- 8. მიმდინარე წელი Footer-ში ---- */
  const yearEl = document.getElementById('currentYear');
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }
})();
