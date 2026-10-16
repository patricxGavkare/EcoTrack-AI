/**
 * Modals & Overlay Module (modals.js)
 * Manages profile menu dropdown, login/edit profile modal, viva defense modal, and API health checks.
 */

import { AppState, DOM } from './state.js';
import { Storage } from './storage.js';
import { renderUserProfile, showToast } from './dashboard.js';

/**
 * Setup modal and profile dropdown event handlers
 */
export function setupModalEvents(switchTabFn) {
  // 1. Sidebar Profile Panel Toggle
  if (DOM.btnProfileMenu) {
    DOM.btnProfileMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      DOM.profileDropdownCard?.classList.toggle('active');
    });
  }

  // Close profile dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (DOM.profileDropdownCard && DOM.profileDropdownCard.classList.contains('active')) {
      if (!DOM.profileDropdownCard.contains(e.target) && !DOM.btnProfileMenu?.contains(e.target)) {
        DOM.profileDropdownCard.classList.remove('active');
      }
    }
  });

  // Icon Grid: Navigate to tab and close panel
  document.querySelectorAll('.pdc-icon-box').forEach(box => {
    box.addEventListener('click', () => {
      const tab = box.dataset.tabTarget;
      if (tab) {
        DOM.profileDropdownCard?.classList.remove('active');
        if (typeof switchTabFn === 'function') switchTabFn(tab);
      }
    });
  });

  // Open Viva Guide Modal from Profile Menu
  if (DOM.btnProfileViva) {
    DOM.btnProfileViva.addEventListener('click', () => {
      DOM.profileDropdownCard?.classList.remove('active');
      DOM.vivaModalOverlay?.classList.add('active');
    });
  }

  // Open Login / Customise Profile Modal
  if (DOM.btnEditProfile) {
    DOM.btnEditProfile.addEventListener('click', () => {
      DOM.profileDropdownCard?.classList.remove('active');
      if (DOM.inputProfileName) DOM.inputProfileName.value = AppState.userProfile.name || '';
      if (DOM.inputProfileEmail) DOM.inputProfileEmail.value = AppState.userProfile.email || '';
      if (DOM.inputProfileCollege) DOM.inputProfileCollege.value = AppState.userProfile.college || '';
      DOM.loginModalOverlay?.classList.add('active');
    });
  }

  if (DOM.btnOpenLoginModal) {
    DOM.btnOpenLoginModal.addEventListener('click', () => {
      DOM.profileDropdownCard?.classList.remove('active');
      if (DOM.inputProfileName) DOM.inputProfileName.value = '';
      if (DOM.inputProfileEmail) DOM.inputProfileEmail.value = '';
      if (DOM.inputProfileCollege) DOM.inputProfileCollege.value = '';
      DOM.loginModalOverlay?.classList.add('active');
    });
  }

  if (DOM.btnCloseLogin) {
    DOM.btnCloseLogin.addEventListener('click', () => {
      DOM.loginModalOverlay?.classList.remove('active');
    });
  }

  if (DOM.loginModalOverlay) {
    DOM.loginModalOverlay.addEventListener('click', (e) => {
      if (e.target === DOM.loginModalOverlay) {
        DOM.loginModalOverlay.classList.remove('active');
      }
    });
  }

  // Dynamic initial update in modal avatar circle
  if (DOM.inputProfileName) {
    DOM.inputProfileName.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (DOM.modalAvatarPreview) {
        DOM.modalAvatarPreview.textContent = val ? val.charAt(0).toUpperCase() : 'P';
      }
    });
  }

  // Save Profile / Sign In Submission
  if (DOM.loginForm) {
    DOM.loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      AppState.userProfile.name = DOM.inputProfileName.value.trim();
      AppState.userProfile.email = DOM.inputProfileEmail.value.trim();
      AppState.userProfile.college = DOM.inputProfileCollege.value.trim();
      Storage.set('ecotrack_user_profile', AppState.userProfile);

      renderUserProfile();
      DOM.loginModalOverlay?.classList.remove('active');
      showToast(`👤 Signed in as ${AppState.userProfile.name}!`);
    });
  }

  // Switch between Personal & College Profiles
  if (DOM.itemProfileCollege) {
    DOM.itemProfileCollege.addEventListener('click', () => {
      AppState.userProfile.name = 'PRATIK';
      AppState.userProfile.email = 'pratik@vit.edu';
      AppState.userProfile.college = 'VIT Pune';
      AppState.userProfile.streakDays = 0;
      Storage.set('ecotrack_user_profile', AppState.userProfile);
      renderUserProfile();

      if (DOM.switchProfileName1) DOM.switchProfileName1.style.display = 'none';
      const collegeCheck = DOM.itemProfileCollege.querySelector('.pdc-menu-arrow');
      if (collegeCheck) { collegeCheck.textContent = '✓'; collegeCheck.style.color = 'var(--accent-mint)'; }
      DOM.profileDropdownCard?.classList.remove('active');
      showToast('🎓 Switched to PRATIK (vit.edu) College Profile!');
    });
  }

  if (DOM.itemProfilePersonal) {
    DOM.itemProfilePersonal.addEventListener('click', () => {
      AppState.userProfile.name = 'Pratik';
      AppState.userProfile.email = 'pratikgavkare28@gmail.com';
      AppState.userProfile.college = 'VIT Pune';
      AppState.userProfile.streakDays = 8;
      Storage.set('ecotrack_user_profile', AppState.userProfile);
      renderUserProfile();

      if (DOM.switchProfileName1) DOM.switchProfileName1.style.display = '';
      const collegeCheck = DOM.itemProfileCollege ? DOM.itemProfileCollege.querySelector('.pdc-menu-arrow') : null;
      if (collegeCheck) { collegeCheck.textContent = '›'; collegeCheck.style.color = ''; }
      DOM.profileDropdownCard?.classList.remove('active');
      showToast('👤 Switched to Pratik (Personal) Profile!');
    });
  }

  // Sign out to Guest Mode
  if (DOM.btnSignOut) {
    DOM.btnSignOut.addEventListener('click', () => {
      AppState.userProfile.name = 'Guest Student';
      AppState.userProfile.email = 'guest@ecotrack.local';
      AppState.userProfile.college = 'Guest Campus';
      renderUserProfile();
      DOM.profileDropdownCard?.classList.remove('active');
      showToast('🚪 Logged out to Guest Student Profile.');
    });
  }

  // Academic Viva Guide Modal Handlers
  if (DOM.btnCloseViva) {
    DOM.btnCloseViva.addEventListener('click', () => {
      DOM.vivaModalOverlay?.classList.remove('active');
    });
  }

  if (DOM.vivaModalOverlay) {
    DOM.vivaModalOverlay.addEventListener('click', (e) => {
      if (e.target === DOM.vivaModalOverlay) {
        DOM.vivaModalOverlay.classList.remove('active');
      }
    });
  }

  // Global Escape Key Listener
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (DOM.vivaModalOverlay?.classList.contains('active')) DOM.vivaModalOverlay.classList.remove('active');
      if (DOM.loginModalOverlay?.classList.contains('active')) DOM.loginModalOverlay.classList.remove('active');
      if (DOM.profileDropdownCard?.classList.contains('active')) DOM.profileDropdownCard.classList.remove('active');
    }
  });
}

/**
 * Check backend connection status asynchronously
 */
export async function checkBackend() {
  if (!window.AIEngine || !DOM.apiStatusText) return;
  const status = await window.AIEngine.testBackendConnection();
  DOM.apiStatusText.textContent = status.message;
  if (DOM.statusDot) {
    if (status.connected) {
      DOM.statusDot.style.background = '#10b981';
      DOM.statusDot.style.boxShadow = '0 0 8px #10b981';
    } else {
      DOM.statusDot.style.background = '#f59e0b';
      DOM.statusDot.style.boxShadow = '0 0 8px #f59e0b';
    }
  }
}
