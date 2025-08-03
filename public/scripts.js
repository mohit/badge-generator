/**
 * Badge Generator - Main JavaScript
 * Handles interactions, animations, and dynamic behavior
 */

document.addEventListener('DOMContentLoaded', function() {
    
    // ========================================
    // Scroll-triggered animations
    // ========================================
    
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, observerOptions);

    // Observe all elements with scroll-animate class
    document.querySelectorAll('.scroll-animate').forEach(el => {
        observer.observe(el);
    });

    // ========================================
    // Smooth scrolling for anchor links
    // ========================================
    
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // ========================================
    // Mobile navigation toggle (if needed)
    // ========================================
    
    const createMobileNav = () => {
        const nav = document.querySelector('nav');
        const navLinks = document.querySelector('.nav-links');
        
        // Create mobile menu button
        const mobileMenuBtn = document.createElement('button');
        mobileMenuBtn.className = 'mobile-menu-btn';
        mobileMenuBtn.innerHTML = '☰';
        mobileMenuBtn.setAttribute('aria-label', 'Toggle navigation menu');
        
        // Add mobile styles
        const style = document.createElement('style');
        style.textContent = `
            .mobile-menu-btn {
                display: none;
                background: none;
                border: none;
                font-size: 1.5rem;
                color: var(--text-primary);
                cursor: pointer;
                padding: 0.5rem;
            }
            
            @media (max-width: 768px) {
                .mobile-menu-btn {
                    display: block;
                }
                
                .nav-links {
                    display: none;
                    position: absolute;
                    top: 100%;
                    left: 0;
                    right: 0;
                    background: var(--background);
                    border-top: 1px solid var(--border);
                    flex-direction: column;
                    gap: 0;
                    box-shadow: var(--shadow-lg);
                }
                
                .nav-links.active {
                    display: flex;
                }
                
                .nav-links li {
                    border-bottom: 1px solid var(--border);
                }
                
                .nav-links li:last-child {
                    border-bottom: none;
                }
                
                .nav-links a {
                    display: block;
                    padding: 1rem 2rem;
                    width: 100%;
                }
            }
        `;
        document.head.appendChild(style);
        
        // Add mobile menu functionality
        nav.style.position = 'relative';
        nav.appendChild(mobileMenuBtn);
        
        mobileMenuBtn.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            mobileMenuBtn.innerHTML = navLinks.classList.contains('active') ? '✕' : '☰';
        });
        
        // Close mobile menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!nav.contains(e.target)) {
                navLinks.classList.remove('active');
                mobileMenuBtn.innerHTML = '☰';
            }
        });
        
        // Close mobile menu when clicking on a link
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('active');
                mobileMenuBtn.innerHTML = '☰';
            });
        });
    };
    
    // Initialize mobile navigation
    createMobileNav();

    // ========================================
    // Enhanced badge demo interactions
    // ========================================
    
    const demoBadge = document.querySelector('.demo-badge');
    if (demoBadge) {
        demoBadge.addEventListener('mouseenter', () => {
            demoBadge.style.transform = 'translateY(-5px) scale(1.02)';
            demoBadge.style.boxShadow = 'var(--shadow-xl)';
        });
        
        demoBadge.addEventListener('mouseleave', () => {
            demoBadge.style.transform = '';
            demoBadge.style.boxShadow = '';
        });
    }

    // ========================================
    // Dynamic status counters (optional enhancement)
    // ========================================
    
    const animateCounters = () => {
        const statusItems = document.querySelectorAll('.status-item');
        const hasCounters = document.querySelector('[data-count]');
        
        if (!hasCounters) return; // Only run if we have counter elements
        
        statusItems.forEach(item => {
            const counter = item.querySelector('[data-count]');
            if (!counter) return;
            
            const target = parseInt(counter.dataset.count);
            const duration = 2000; // 2 seconds
            const step = target / (duration / 16); // 60fps
            let current = 0;
            
            const updateCounter = () => {
                current += step;
                if (current < target) {
                    counter.textContent = Math.floor(current);
                    requestAnimationFrame(updateCounter);
                } else {
                    counter.textContent = target;
                }
            };
            
            // Start animation when element comes into view
            const counterObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        updateCounter();
                        counterObserver.unobserve(entry.target);
                    }
                });
            });
            
            counterObserver.observe(item);
        });
    };
    
    // Initialize counters if they exist
    animateCounters();

    // ========================================
    // Form handling (if forms are added later)
    // ========================================
    
    const handleForms = () => {
        const forms = document.querySelectorAll('form');
        
        forms.forEach(form => {
            form.addEventListener('submit', function(e) {
                // Add form validation and submission handling here
                const submitBtn = form.querySelector('button[type="submit"]');
                if (submitBtn) {
                    const originalText = submitBtn.textContent;
                    submitBtn.textContent = 'Loading...';
                    submitBtn.disabled = true;
                    
                    // Re-enable after processing (adjust based on actual form handling)
                    setTimeout(() => {
                        submitBtn.textContent = originalText;
                        submitBtn.disabled = false;
                    }, 2000);
                }
            });
        });
    };
    
    // Initialize form handling
    handleForms();

    // ========================================
    // Performance optimizations
    // ========================================
    
    // Debounce scroll events
    let scrollTimeout;
    const handleScroll = () => {
        if (scrollTimeout) {
            clearTimeout(scrollTimeout);
        }
        scrollTimeout = setTimeout(() => {
            // Add any scroll-based functionality here
        }, 10);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });

    // ========================================
    // Analytics and tracking (placeholder)
    // ========================================
    
    const trackEvent = (eventName, properties = {}) => {
        // Add analytics tracking here (Google Analytics, Mixpanel, etc.)
        console.log('Event:', eventName, properties);
    };
    
    // Track CTA clicks
    document.querySelectorAll('.btn-primary').forEach(btn => {
        btn.addEventListener('click', () => {
            trackEvent('cta_click', {
                button_text: btn.textContent.trim(),
                page: window.location.pathname
            });
        });
    });
    
    // Track navigation clicks
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            trackEvent('nav_click', {
                link_text: link.textContent.trim(),
                href: link.getAttribute('href')
            });
        });
    });

    // ========================================
    // Accessibility enhancements
    // ========================================
    
    // Add keyboard navigation support
    document.addEventListener('keydown', (e) => {
        // Skip links functionality
        if (e.key === 'Tab' && !e.shiftKey) {
            // Add skip link if it doesn't exist
            let skipLink = document.querySelector('.skip-link');
            if (!skipLink) {
                skipLink = document.createElement('a');
                skipLink.className = 'skip-link sr-only';
                skipLink.href = '#main-content';
                skipLink.textContent = 'Skip to main content';
                document.body.insertBefore(skipLink, document.body.firstChild);
                
                skipLink.addEventListener('focus', () => {
                    skipLink.classList.remove('sr-only');
                });
                
                skipLink.addEventListener('blur', () => {
                    skipLink.classList.add('sr-only');
                });
            }
        }
    });
    
    // Enhance focus management
    const focusableElements = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const firstFocusableElement = document.querySelectorAll(focusableElements)[0];
    const lastFocusableElement = document.querySelectorAll(focusableElements)[document.querySelectorAll(focusableElements).length - 1];
    
    // Add focus indicators for better accessibility
    const style = document.createElement('style');
    style.textContent = `
        .btn:focus,
        .nav-links a:focus,
        .logo:focus {
            outline: 2px solid var(--primary);
            outline-offset: 2px;
        }
        
        .skip-link {
            position: absolute;
            top: -40px;
            left: 6px;
            background: var(--primary);
            color: white;
            padding: 8px;
            z-index: 1000;
            border-radius: 4px;
            text-decoration: none;
        }
        
        .skip-link:focus {
            top: 6px;
        }
    `;
    document.head.appendChild(style);

    console.log('Badge Generator initialized successfully');
});