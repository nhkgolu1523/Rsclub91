/* =====================================================================
   Popup settings.

   Change `image` to use your own welcome image. The path is relative to
   the Home page (pages/home/index.html).
   You can also override it without editing this file:
     - localStorage.setItem('rs_login_popup_image', 'https://.../my.jpg')
     - or open Home with ?popupImage=https://.../my.jpg
   ===================================================================== */
window.RS_POPUP_CONFIG = {
  login: {
    enabled: true,
    image: '../../assets/images/login-popup.jpg',
    title: 'Welcome to Rsclub91',
    heading: 'ENJOY THE WORLD OF RSCLUB91',
    subheading: 'Experience exciting games, Exclusive Rewards, And Endless Entertainment All in one place',
    tagline: 'Play Safe  Enjoy More  Win More',
    confirmText: 'Confirm'
  },
  firstDeposit: {
    enabled: true,
    title: 'Extra first deposit bonus',
    tip: 'Each account can only receive rewards once'
  }
};
